package org.ntrloc.graph.db.partition.authorization;

import jakarta.annotation.PostConstruct;
import org.ntrloc.graph.db.partition.authorization.repository.AuthorizationRepository;
import org.ntrloc.graph.db.partition.schema.event.SchemaChangeEvent;
import org.ntrloc.graph.db.partition.security.repository.SecurityRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.UUID;

// @DependsOnDatabaseInitialization (not a literal @DependsOn on Flyway's own bean name) is Boot's
// purpose-built mechanism for this: FlywayAutoConfiguration already @Imports
// DatabaseInitializationDependencyConfigurer, which wires a real BeanDefinition-level dependsOn
// from any bean carrying this annotation onto whatever DatabaseInitializerDetector finds (Flyway's
// migration bean) -- guaranteed ordering, not an assumption about JdbcClient bean wiring. Needed
// because ensureGroupExists() below is the only DML left running at boot now that schema_* tables
// are Flyway-managed rather than always-already-there via the old *Initializer @PostConstruct DDL.
@Component
@DependsOnDatabaseInitialization
public class DefaultGroupInitializer {

    public static final String DEFAULT_GROUP_NAME = "everyone";

    private final SecurityRepository securityRepo;
    private final AuthorizationRepository authorizationRepo;
    private final JdbcClient jdbcClient;

    public DefaultGroupInitializer(SecurityRepository securityRepo, AuthorizationRepository authorizationRepo,
                                    JdbcClient jdbcClient) {
        this.securityRepo = securityRepo;
        this.authorizationRepo = authorizationRepo;
        this.jdbcClient = jdbcClient;
    }

    @PostConstruct
    void ensureGroupExists() {
        if (securityRepo.findGroupByName(DEFAULT_GROUP_NAME).isEmpty()) {
            securityRepo.createGroup(DEFAULT_GROUP_NAME);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    void populateAfterStartup() {
        var group = securityRepo.findGroupByName(DEFAULT_GROUP_NAME).orElseThrow();
        addAllExistingUsersToGroup(group.id());
        grantReadForUncoveredItemTypes(group.id());
    }

    @EventListener
    public void onItemTypeCreated(SchemaChangeEvent.ItemTypeCreated event) {
        var group = securityRepo.findGroupByName(DEFAULT_GROUP_NAME).orElseThrow();
        grantReadForItemType(event.itemTypeId(), group.id());
    }

    @EventListener
    public void onLinkTypeCreated(SchemaChangeEvent.LinkTypeCreated event) {
        // Link types have no independent type-visibility grant of their own -- visible iff both
        // participant item types are visible (see docs/ntrloc-security-projections-summary.md
        // "Type Visibility"). Nothing to do here; hook stays for parity with onItemTypeCreated.
    }

    public UUID getDefaultGroupId() {
        return securityRepo.findGroupByName(DEFAULT_GROUP_NAME).orElseThrow().id();
    }

    // Every user-creation path (UserAdminController, LocalAccountSeeder,
    // AuthorizationTestDataInitializer) must call this so nobody ends up uncovered until the next
    // restart's populateAfterStartup backfill catches them -- addUserToGroup is itself idempotent
    // (ON CONFLICT DO NOTHING) so calling this twice for the same user is harmless. A caller that
    // constructor-injects DefaultGroupInitializer is guaranteed ensureGroupExists() has already run
    // (Spring fully initializes a bean, @PostConstruct included, before handing it to a dependent
    // bean's constructor), so getDefaultGroupId() below never races the group's own creation.
    public void addUserToDefaultGroup(UUID userId) {
        securityRepo.addUserToGroup(userId, getDefaultGroupId());
    }

    private void addAllExistingUsersToGroup(UUID groupId) {
        jdbcClient.sql("""
                INSERT INTO security_group_member (user_id, group_id)
                SELECT id, :groupId FROM security_user
                WHERE id NOT IN (SELECT user_id FROM security_group_member WHERE group_id = :groupId)
                """)
                .param("groupId", groupId)
                .update();
    }

    // "Uncovered" means no default-visibility decision has ever been made for this type -- not
    // "has no grant right now". An admin's explicit revocation must survive this backfill running
    // again on a later restart; see the migration comment on schema_item.default_visibility_decided.
    private void grantReadForUncoveredItemTypes(UUID groupId) {
        jdbcClient.sql("SELECT id FROM schema_item WHERE NOT default_visibility_decided")
                .query((rs, n) -> rs.getObject("id", UUID.class))
                .list()
                .forEach(itemTypeId -> grantReadForItemType(itemTypeId, groupId));
    }

    private void grantReadForItemType(UUID itemTypeId, UUID groupId) {
        authorizationRepo.grantItemTypeIfAbsent(itemTypeId, "GROUP", groupId, PermissionService.ITEM_TYPE_READ);
        jdbcClient.sql("UPDATE schema_item SET default_visibility_decided = TRUE WHERE id = :itemTypeId")
                .param("itemTypeId", itemTypeId).update();
    }
}
