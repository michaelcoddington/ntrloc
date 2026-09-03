package org.ntrloc.graph.db.coordinator;

import org.ntrloc.graph.db.partition.schema.ControlledListManager;
import org.ntrloc.graph.db.partition.schema.SchemaManager;
import org.ntrloc.graph.db.partition.schema.definition.PropertyCardinality;
import org.ntrloc.graph.db.partition.schema.definition.PropertyType;
import org.ntrloc.graph.db.partition.schema.definition.PropertyUsage;
import org.ntrloc.graph.db.partition.schema.definition.mutation.CreateItemDefinitionMutation;
import org.ntrloc.graph.db.partition.schema.definition.mutation.CreateLinkDefinitionMutation;
import org.ntrloc.graph.db.partition.schema.definition.mutation.CreatePerspectiveDefinitionMutation;
import org.ntrloc.graph.db.partition.schema.definition.mutation.CreatePropertyDefinitionMutation;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminItemDefinitionView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminItemLinkPerspectiveView;
import org.ntrloc.graph.db.partition.schema.definition.view.admin.AdminPropertyDefinitionView;
import org.ntrloc.graph.domain.DomainInitializer;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

// Runs once, self-triggered like every other DomainInitializer (see that interface's class
// comment for why ApplicationRunner, not @PostConstruct), before any coordinator/mutation test
// reads its fixture ids. Everything goes through SchemaManager.applyMutations() -- the same API
// the admin UI's schema editor uses -- rather than the lower-level SchemaRepository, so
// RegisterPartitionManager's reaction to SchemaChangeEvent creates the per-item-type/per-link-type
// register tables exactly the way it would for a live admin edit. One consequence: an item type
// can never share a literal property with another item type (never legal in this schema model,
// just different properties that happen to share a name/label) -- Product and Contributor each get
// their own separate "name" property here, not one shared id.
@Component
public class CoordinatorTestDomainInitializer implements DomainInitializer, ApplicationRunner {

    private final SchemaManager schemaManager;
    private final ControlledListManager controlledListManager;

    private UUID productTypeId;
    private UUID contributorTypeId;
    private UUID linkTypeId;
    private UUID productPerspectiveId;
    private UUID contributorPerspectiveId;
    private UUID namePropertyId;
    private UUID contributorNamePropertyId;
    private UUID colorPropertyId;
    private UUID rolePropertyId;
    private UUID dimensionsWidthPropertyId;
    private UUID dimensionsHeightPropertyId;

    public CoordinatorTestDomainInitializer(SchemaManager schemaManager, ControlledListManager controlledListManager) {
        this.schemaManager = schemaManager;
        this.controlledListManager = controlledListManager;
    }

    @Override
    public void run(ApplicationArguments args) {
        initSchema(schemaManager, controlledListManager);
    }

    @Override
    public void initSchema(SchemaManager schemaManager, ControlledListManager controlledListManager) {
        schemaManager.applyMutations(List.of(new CreateItemDefinitionMutation(
                "CoordinatorTestProduct", "Coordinator integration test fixture",
                List.of(
                        property("name", PropertyType.STRING, PropertyCardinality.SINGLE),
                        property("color", PropertyType.STRING, PropertyCardinality.SINGLE),
                        property("tags", PropertyType.STRING, PropertyCardinality.SET),
                        property("releaseDate", PropertyType.DATE, PropertyCardinality.SINGLE),
                        objectProperty("dimensions",
                                property("width", PropertyType.STRING, PropertyCardinality.SINGLE),
                                property("height", PropertyType.STRING, PropertyCardinality.SINGLE))),
                null, false, null)));

        AdminItemDefinitionView product = findItem(schemaManager, "CoordinatorTestProduct");
        productTypeId = product.id();
        namePropertyId = findProperty(product.properties(), "name");
        colorPropertyId = findProperty(product.properties(), "color");
        var dimensions = (org.ntrloc.graph.db.partition.schema.definition.view.admin.ObjectAdminPropertyDefinitionView)
                product.properties().stream().filter(p -> p.name().equals("dimensions")).findFirst().orElseThrow();
        dimensionsWidthPropertyId = findProperty(dimensions.properties(), "width");
        dimensionsHeightPropertyId = findProperty(dimensions.properties(), "height");

        schemaManager.applyMutations(List.of(new CreateItemDefinitionMutation(
                "CoordinatorTestContributor", "Coordinator integration test fixture",
                List.of(property("name", PropertyType.STRING, PropertyCardinality.SINGLE)), null, false, null)));

        AdminItemDefinitionView contributor = findItem(schemaManager, "CoordinatorTestContributor");
        contributorTypeId = contributor.id();
        contributorNamePropertyId = findProperty(contributor.properties(), "name");

        schemaManager.applyMutations(List.of(new CreateLinkDefinitionMutation(
                List.of(property("role", PropertyType.STRING, PropertyCardinality.SINGLE)),
                List.of(
                        new CreatePerspectiveDefinitionMutation(productTypeId, "products", "desc", 0, null),
                        new CreatePerspectiveDefinitionMutation(contributorTypeId, "contributors", "desc", 0, null)))));

        AdminItemDefinitionView productAfterLink = findItem(schemaManager, "CoordinatorTestProduct");
        AdminItemLinkPerspectiveView productPerspective = productAfterLink.links().get("products").get(0);
        productPerspectiveId = productPerspective.id();
        linkTypeId = productPerspective.linkId();

        AdminItemDefinitionView contributorAfterLink = findItem(schemaManager, "CoordinatorTestContributor");
        contributorPerspectiveId = contributorAfterLink.links().get("contributors").get(0).id();

        rolePropertyId = schemaManager.getAdminSchema().links().stream()
                .filter(link -> link.id().equals(linkTypeId))
                .findFirst()
                .map(link -> findProperty(link.properties(), "role"))
                .orElseThrow();
    }

    private CreatePropertyDefinitionMutation property(String name, PropertyType type, PropertyCardinality cardinality) {
        return new CreatePropertyDefinitionMutation(name, "Coordinator integration test fixture", type, cardinality, PropertyUsage.OPTIONAL, false, java.util.List.of());
    }

    private CreatePropertyDefinitionMutation objectProperty(String name, CreatePropertyDefinitionMutation... children) {
        return new CreatePropertyDefinitionMutation(name, "Coordinator integration test fixture", PropertyType.OBJECT,
                PropertyCardinality.SINGLE, PropertyUsage.OPTIONAL, false, List.of(children));
    }

    private AdminItemDefinitionView findItem(SchemaManager schemaManager, String name) {
        return schemaManager.getAdminSchema().items().stream()
                .filter(item -> item.name().equals(name))
                .findFirst()
                .orElseThrow();
    }

    private UUID findProperty(List<AdminPropertyDefinitionView> properties, String name) {
        return properties.stream()
                .filter(p -> p.name().equals(name))
                .findFirst()
                .map(AdminPropertyDefinitionView::id)
                .orElseThrow();
    }

    public UUID productTypeId() {
        return productTypeId;
    }

    public UUID contributorTypeId() {
        return contributorTypeId;
    }

    public UUID linkTypeId() {
        return linkTypeId;
    }

    public UUID productPerspectiveId() {
        return productPerspectiveId;
    }

    public UUID contributorPerspectiveId() {
        return contributorPerspectiveId;
    }

    public UUID namePropertyId() {
        return namePropertyId;
    }

    public UUID contributorNamePropertyId() {
        return contributorNamePropertyId;
    }

    public UUID colorPropertyId() {
        return colorPropertyId;
    }

    public UUID rolePropertyId() {
        return rolePropertyId;
    }

    public UUID dimensionsWidthPropertyId() {
        return dimensionsWidthPropertyId;
    }

    public UUID dimensionsHeightPropertyId() {
        return dimensionsHeightPropertyId;
    }
}
