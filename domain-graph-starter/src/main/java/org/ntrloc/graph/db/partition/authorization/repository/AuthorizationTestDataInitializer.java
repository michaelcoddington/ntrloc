package org.ntrloc.graph.db.partition.authorization.repository;

import org.ntrloc.graph.db.partition.authorization.DefaultGroupInitializer;
import org.ntrloc.graph.db.partition.authorization.PermissionService;
import org.ntrloc.graph.db.partition.schema.SchemaManager;
import org.ntrloc.graph.db.partition.schema.definition.mutation.CreateItemDefinitionMutation;
import org.ntrloc.graph.db.partition.security.repository.SecurityRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@ConditionalOnProperty(prefix = "graph.security", name = "seed-test-data", havingValue = "true")
@DependsOn("schemaManager")
@DependsOnDatabaseInitialization
public class AuthorizationTestDataInitializer implements ApplicationRunner {

    private final SchemaManager schemaManager;
    private final SecurityRepository securityRepo;
    private final AuthorizationRepository authorizationRepo;
    private final JdbcClient jdbcClient;
    private final DefaultGroupInitializer defaultGroupInitializer;

    public AuthorizationTestDataInitializer(SchemaManager schemaManager, SecurityRepository securityRepo,
                                             AuthorizationRepository authorizationRepo, JdbcClient jdbcClient,
                                             DefaultGroupInitializer defaultGroupInitializer) {
        this.schemaManager = schemaManager;
        this.securityRepo = securityRepo;
        this.authorizationRepo = authorizationRepo;
        this.jdbcClient = jdbcClient;
        this.defaultGroupInitializer = defaultGroupInitializer;
    }

    // Not @PostConstruct: applyMutations() below publishes SchemaChangeEvent, and
    // RegisterPartitionManager's @EventListener reaction to it (creating this type's register
    // table) isn't wired up until every singleton has finished construction. ApplicationRunner
    // guarantees this runs after the whole context -- including that listener -- is ready.
    @Override
    public void run(ApplicationArguments args) {
        // Test item types are created through the real mutation pipeline (not raw DDL) so
        // SchemaManager's cache stays consistent — it has no external invalidation hook
        // besides applyMutations. AclTestUnmarkedDoc deliberately gets no marker assignment at
        // all, to prove superusers bypass the default-deny behavior that blocks everyone else.
        schemaManager.applyMutations(List.of(
                new CreateItemDefinitionMutation("AclTestPublicDoc", "ACL tracer bullet: group-granted type", List.of(), null, false, null),
                new CreateItemDefinitionMutation("AclTestConfidentialDoc", "ACL tracer bullet: user-granted type", List.of(), null, false, null),
                new CreateItemDefinitionMutation("AclTestUnmarkedDoc", "ACL tracer bullet: no marker assigned, superuser-only", List.of(), null, false, null)
        ));

        Map<String, UUID> itemsByName = schemaManager.getAdminSchema().items().stream()
                .collect(Collectors.toMap(item -> item.name(), item -> item.id()));
        UUID publicDocId = itemsByName.get("AclTestPublicDoc");
        UUID confidentialDocId = itemsByName.get("AclTestConfidentialDoc");
        UUID unmarkedDocId = itemsByName.get("AclTestUnmarkedDoc");

        // DefaultGroupInitializer.onItemTypeCreated reacts to the CreateItemDefinitionMutation
        // above by immediately granting the "everyone" group read on each of these three types
        // (nothing covers them yet at that instant) -- by design, so newly created item types
        // are readable by default until something more specific takes over. These three exist
        // specifically to prove the *opposite* (default-deny, opt-in via marker), so that default
        // grant has to be stripped for them before it's meaningful to assert anything below.
        revokeDefaultReadGrant(publicDocId);
        revokeDefaultReadGrant(confidentialDocId);
        revokeDefaultReadGrant(unmarkedDocId);

        var alice = securityRepo.createUser("alice", "Alice (viewer group member)", null, false);
        var bob = securityRepo.createUser("bob", "Bob (viewer group member)", null, false);
        var carol = securityRepo.createUser("carol", "Carol (direct grant, no group)", null, false);
        var root = securityRepo.createUser("root", "Root (superuser)", null, true);
        defaultGroupInitializer.addUserToDefaultGroup(alice.id());
        defaultGroupInitializer.addUserToDefaultGroup(bob.id());
        defaultGroupInitializer.addUserToDefaultGroup(carol.id());
        defaultGroupInitializer.addUserToDefaultGroup(root.id());

        var viewers = securityRepo.createGroup("viewers");
        securityRepo.addUserToGroup(alice.id(), viewers.id());
        securityRepo.addUserToGroup(bob.id(), viewers.id());

        authorizationRepo.grantItemType(publicDocId, "GROUP", viewers.id(), PermissionService.ITEM_TYPE_READ);
        authorizationRepo.grantItemType(confidentialDocId, "USER", carol.id(), PermissionService.ITEM_TYPE_READ);
    }

    private void revokeDefaultReadGrant(UUID itemTypeId) {
        UUID everyoneGroupId = securityRepo.findGroupByName(DefaultGroupInitializer.DEFAULT_GROUP_NAME).orElseThrow().id();
        jdbcClient.sql("""
                DELETE FROM authorization_item_type_grant
                WHERE item_type_id = :itemTypeId AND permission = :permission
                  AND principal_type = 'GROUP' AND principal_id = :groupId
                """)
                .param("itemTypeId", itemTypeId)
                .param("permission", PermissionService.ITEM_TYPE_READ)
                .param("groupId", everyoneGroupId)
                .update();
    }
}
