package org.ntrloc.graph.db.partition.process.dmn;

import org.flowable.dmn.api.DmnDecision;
import org.flowable.dmn.api.DmnDeployment;
import org.flowable.dmn.api.DmnRepositoryService;
import org.ntrloc.graph.db.partition.process.ShortIdGenerator;
import org.ntrloc.graph.db.partition.process.WorkflowReferenceScanner;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

// Mirrors ProcessAdminController exactly, DMN-side.
@RestController
@RequestMapping("/api/admin/dmn")
public class DecisionAdminController {

    public record DecisionDefinitionView(String id, String key, String name, int version, String deploymentId) {}

    public record DeployErrorResponse(String message) {}

    private final DmnRepositoryService dmnRepositoryService;
    private final WorkflowReferenceScanner referenceScanner;

    public DecisionAdminController(DmnRepositoryService dmnRepositoryService, WorkflowReferenceScanner referenceScanner) {
        this.dmnRepositoryService = dmnRepositoryService;
        this.referenceScanner = referenceScanner;
    }

    @GetMapping("/decisions")
    ResponseEntity<List<DecisionDefinitionView>> getDecisions() {
        List<DecisionDefinitionView> decisions = dmnRepositoryService.createDecisionQuery()
                .list().stream()
                .map(this::toView)
                .toList();
        return ResponseEntity.ok(decisions);
    }

    // id is a query param, not a path variable -- same reasoning as ProcessAdminController's
    // getDefinitionXml: decision ids follow the same "<key>:<version>:<generatedId>" shape, and a
    // literal colon in a path segment 404s (Reactor Netty's URI parsing, ahead of Spring routing).
    @GetMapping("/decisions/xml")
    Mono<ResponseEntity<String>> getDecisionXml(@RequestParam String id) {
        return Mono.fromCallable(() -> {
                    try (InputStream in = dmnRepositoryService.getDmnResource(id)) {
                        return new String(in.readAllBytes(), StandardCharsets.UTF_8);
                    }
                })
                .subscribeOn(Schedulers.boundedElastic())
                .map(xml -> ResponseEntity.ok().contentType(MediaType.APPLICATION_XML).body(xml));
    }

    // First-ever save of a brand-new decision table (see ntrloc-decision-table-editor.js's own
    // comment on why this is a separate endpoint from deployNewVersion below, not just that one
    // called with whatever key the client happened to propose). candidateKey is usually a random
    // guess from the admin-ui's own short-id.js, occasionally something the admin typed
    // themselves -- either way, this is the one place actual uniqueness is enforced: a "new"
    // decision table always means "creation," never "add a version to something that already
    // exists," so a candidate that turns out to collide with an existing key gets silently
    // replaced with a fresh one (all its occurrences swapped in the XML, since dmn-io.js's own
    // serializeDrd interpolates the same key string into every id attribute the DRD needs) rather
    // than being deployed as an unintended new version of an unrelated decision table. The
    // response's key tells the caller what was actually used, so it can update its own display if
    // this ever differs from what it sent.
    @PostMapping("/decisions")
    ResponseEntity<?> createDecision(@RequestParam String candidateKey, @RequestBody String xml) {
        try {
            String key = candidateKey;
            String body = xml;
            int attempts = 0;
            while (dmnRepositoryService.createDecisionQuery().decisionKey(key).count() > 0) {
                if (++attempts > 20) {
                    return ResponseEntity.internalServerError()
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(new DeployErrorResponse("Could not allocate a unique decision key."));
                }
                String nextKey = ShortIdGenerator.generate("d");
                body = body.replace(key, nextKey);
                key = nextKey;
            }
            DmnDeployment deployment = dmnRepositoryService.createDeployment()
                    .name(key)
                    .addString(key + ".dmn", body)
                    .deploy();
            DmnDecision decision = dmnRepositoryService.createDecisionQuery()
                    .deploymentId(deployment.getId())
                    .decisionKey(key)
                    .singleResult();
            return ResponseEntity.ok(toView(decision));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new DeployErrorResponse("Failed to deploy decision table: " + e.getMessage()));
        }
    }

    // Same "always a brand-new deployment, Flowable assigns the next version by key" behavior as
    // ProcessAdminController.deployNewVersion, and the same broad RuntimeException catch -- DMN
    // XML parse failures surface as org.flowable.dmn.xml.exceptions.DmnXMLException (a
    // RuntimeException, not necessarily a FlowableException), so a specific catch type would risk
    // missing some failure modes. Only ever called for a key that's already established (see
    // createDecision above for a brand-new one) -- an existing key here always means "add a
    // version," which is exactly what should happen, uniqueness not being a concern for it.
    @PostMapping("/decisions/{key}/versions")
    ResponseEntity<?> deployNewVersion(@PathVariable String key, @RequestBody String xml) {
        try {
            DmnDeployment deployment = dmnRepositoryService.createDeployment()
                    .name(key)
                    .addString(key + ".dmn", xml)
                    .deploy();
            DmnDecision decision = dmnRepositoryService.createDecisionQuery()
                    .deploymentId(deployment.getId())
                    .decisionKey(key)
                    .singleResult();
            return ResponseEntity.ok(toView(decision));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new DeployErrorResponse("Failed to deploy decision table: " + e.getMessage()));
        }
    }

    // DMN-side mirror of ProcessAdminController.deleteDefinition -- deletes every deployed version
    // of this decision key, hard-gated on "not in use": refused with a 409 if any state's
    // entry-marker decision or any marker rule still points at this key. Unlike BPMN there's no
    // cascade concept (a decision has no running "instances"); a plain per-deployment delete is
    // all it takes.
    @DeleteMapping("/decisions/{key}")
    ResponseEntity<?> deleteDecision(@PathVariable String key) {
        List<String> references = referenceScanner.decisionReferences(key);
        if (!references.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new DeployErrorResponse(
                            "Cannot delete decision table \"" + key + "\" -- still referenced by "
                                    + String.join("; ", references) + "."));
        }
        List<String> deploymentIds = dmnRepositoryService.createDecisionQuery()
                .decisionKey(key)
                .list().stream()
                .map(DmnDecision::getDeploymentId)
                .distinct()
                .toList();
        if (deploymentIds.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        deploymentIds.forEach(dmnRepositoryService::deleteDeployment);
        return ResponseEntity.noContent().build();
    }

    private DecisionDefinitionView toView(DmnDecision decision) {
        return new DecisionDefinitionView(decision.getId(), decision.getKey(), decision.getName(),
                decision.getVersion(), decision.getDeploymentId());
    }
}
