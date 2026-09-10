package org.ntrloc.graph.db.partition.process;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.DataSpec;
import org.flowable.bpmn.model.IOSpecification;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.ProcessInstance;
import org.ntrloc.graph.db.partition.process.persistence.NtrlocPrincipalVariableType;
import org.ntrloc.graph.db.partition.security.NtrlocPrincipal;
import org.ntrloc.graph.db.partition.security.PrincipalResolver;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/process")
public class ProcessAdminController {

    public record ProcessDefinitionView(String id, String key, String name, int version, String deploymentId) {}

    public record DeployErrorResponse(String message) {}

    public record ProcessInstanceView(String id, boolean ended) {}

    // variables is @Nullable, not just an empty-default map: a process with no ioSpecification at
    // all should still start with a body-less POST exactly as it always could, not force every
    // caller to send "variables": {}.
    public record StartProcessRequest(@Nullable Map<String, Object> variables) {}

    private final RepositoryService repositoryService;
    private final RuntimeService runtimeService;
    private final PrincipalResolver principalResolver;
    private final WorkflowReferenceScanner referenceScanner;

    public ProcessAdminController(RepositoryService repositoryService, RuntimeService runtimeService,
                                  PrincipalResolver principalResolver, WorkflowReferenceScanner referenceScanner) {
        this.repositoryService = repositoryService;
        this.runtimeService = runtimeService;
        this.principalResolver = principalResolver;
        this.referenceScanner = referenceScanner;
    }

    @GetMapping("/definitions")
    ResponseEntity<List<ProcessDefinitionView>> getDefinitions() {
        List<ProcessDefinitionView> definitions = repositoryService.createProcessDefinitionQuery()
                .latestVersion()
                .list().stream()
                .map(this::toView)
                .toList();
        return ResponseEntity.ok(definitions);
    }

    // Full version history for one key, unlike getDefinitions() above (which now only shows each
    // key's latest via .latestVersion()) -- for a "Version History" panel in the editor. Same path
    // as deployNewVersion below, distinguished by HTTP method (GET vs POST), not a separate route.
    // Ordered oldest-to-newest since Flowable's own version numbers already encode that ordering.
    @GetMapping("/definitions/{key}/versions")
    ResponseEntity<List<ProcessDefinitionView>> getVersions(@PathVariable String key) {
        List<ProcessDefinitionView> versions = repositoryService.createProcessDefinitionQuery()
                .processDefinitionKey(key)
                .orderByProcessDefinitionVersion().asc()
                .list().stream()
                .map(this::toView)
                .toList();
        return ResponseEntity.ok(versions);
    }

    // id is a query param, not a path variable: Flowable's own definition ids follow the format
    // "<key>:<version>:<generatedId>" (e.g. "helloWorld:1:1"), and a literal colon in a path
    // *segment* 404s here even URL-encoded (Reactor Netty's URI parsing, ahead of Spring's own
    // routing -- confirmed empirically, not a Spring PathPattern quirk specific to this route).
    @GetMapping("/definitions/xml")
    Mono<ResponseEntity<String>> getDefinitionXml(@RequestParam String id) {
        return Mono.fromCallable(() -> {
                    try (InputStream in = repositoryService.getProcessModel(id)) {
                        return new String(in.readAllBytes(), StandardCharsets.UTF_8);
                    }
                })
                .subscribeOn(Schedulers.boundedElastic())
                .map(xml -> ResponseEntity.ok().contentType(MediaType.APPLICATION_XML).body(xml));
    }

    // First-ever save of a brand-new process (mirrors DecisionAdminController.createDecision --
    // see its own comment for the full reasoning). candidateKey is usually a random guess from
    // the admin-ui's own short-id.js, occasionally something the admin typed themselves; either
    // way "new" always means creation, never "add a version to something that already exists," so
    // a candidate colliding with an existing process key gets silently replaced with a fresh one
    // (swapped everywhere it appears in the XML) rather than deployed as an unintended version of
    // an unrelated process. The response's key tells the caller what was actually used.
    @PostMapping("/definitions")
    ResponseEntity<?> createDefinition(@RequestParam String candidateKey, @RequestBody String xml) {
        try {
            String key = candidateKey;
            String body = xml;
            int attempts = 0;
            while (repositoryService.createProcessDefinitionQuery().processDefinitionKey(key).count() > 0) {
                if (++attempts > 20) {
                    return ResponseEntity.internalServerError()
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(new DeployErrorResponse("Could not allocate a unique process id."));
                }
                String nextKey = ShortIdGenerator.generate("p");
                body = body.replace(key, nextKey);
                key = nextKey;
            }
            Deployment deployment = repositoryService.createDeployment()
                    .name(key)
                    .addString(key + ".bpmn20.xml", body)
                    .deploy();
            ProcessDefinition definition = repositoryService.createProcessDefinitionQuery()
                    .deploymentId(deployment.getId())
                    .processDefinitionKey(key)
                    .singleResult();
            return ResponseEntity.ok(toView(definition));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new DeployErrorResponse("Failed to deploy process: " + e.getMessage()));
        }
    }

    // Flowable deployments are immutable and versioned: this always creates a brand-new
    // deployment (never overwrites one in place). Flowable auto-detects that the deployed BPMN
    // reuses an existing process key and assigns the next version number itself -- see
    // ProcessDefinitionDataManagerImpl.findLatestProcessDefinitionByKey(). Only ever called for a
    // key that's already established (see createDefinition above for a brand-new one).
    //
    // Broad RuntimeException catch is deliberate: BPMN parse failures during deploy() surface as
    // org.flowable.bpmn.exceptions.XMLException (a plain RuntimeException, not a
    // FlowableException), while other deploy-time validation failures use FlowableException --
    // both, and anything else deploy() might throw, should reach the client as a clean 400 with
    // the underlying message, not a bare 500.
    @PostMapping("/definitions/{key}/versions")
    ResponseEntity<?> deployNewVersion(@PathVariable String key, @RequestBody String xml) {
        try {
            Deployment deployment = repositoryService.createDeployment()
                    .name(key)
                    .addString(key + ".bpmn20.xml", xml)
                    .deploy();
            ProcessDefinition definition = repositoryService.createProcessDefinitionQuery()
                    .deploymentId(deployment.getId())
                    .processDefinitionKey(key)
                    .singleResult();
            return ResponseEntity.ok(toView(definition));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new DeployErrorResponse("Failed to deploy process: " + e.getMessage()));
        }
    }

    // Deletes a process outright -- every deployed version of this key, not just the latest.
    // Hard-gated on "not in use": if any state machine's entry/exit process or transition process
    // still points at this key, the delete is refused with a 409 naming what references it, rather
    // than leaving a dangling reference behind (same contract as schema item-type / trait
    // deletion). cascade=true on deleteDeployment also drops any live process instances of the
    // key -- history is "none" (ProcessEngineConfig), so there's nothing historic to orphan.
    @DeleteMapping("/definitions/{key}")
    ResponseEntity<?> deleteDefinition(@PathVariable String key) {
        List<String> references = referenceScanner.processReferences(key);
        if (!references.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new DeployErrorResponse(
                            "Cannot delete process \"" + key + "\" -- still referenced by "
                                    + String.join("; ", references) + "."));
        }
        List<String> deploymentIds = repositoryService.createProcessDefinitionQuery()
                .processDefinitionKey(key)
                .list().stream()
                .map(ProcessDefinition::getDeploymentId)
                .distinct()
                .toList();
        if (deploymentIds.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        for (String deploymentId : deploymentIds) {
            repositoryService.deleteDeployment(deploymentId, true);
        }
        return ResponseEntity.noContent().build();
    }

    // Same query-param id convention as getDefinitionXml above, for the same reason (a literal
    // colon in a path segment 404s). Runs the specific version the caller names, not just
    // whatever's latest -- the admin editor uses this to run exactly the version currently open.
    // history is "none" (ProcessEngineConfig), so there's no historic API to confirm completion
    // after the fact -- startProcessInstanceById runs the whole thing synchronously in this same
    // call (this example process has no wait states), and returns the very entity Flowable
    // updates in place as it runs, so isEnded() on it already reflects the final state.
    @PostMapping("/definitions/start")
    ResponseEntity<?> startProcessInstance(@RequestParam String id, @RequestBody(required = false) StartProcessRequest request,
                                            ServerHttpRequest httpRequest, Authentication authentication) {
        Map<String, Object> variables = request != null && request.variables() != null
                ? new HashMap<>(request.variables())
                : new HashMap<>();
        List<String> missing;
        try {
            missing = missingRequiredVariables(id, variables);
        } catch (RuntimeException e) {
            // Same "clean 400, not a bare 500" contract as the try/catch below -- an unknown or
            // otherwise bad definition id fails right here (repositoryService.getBpmnModel()),
            // before ever reaching that block.
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new DeployErrorResponse("Failed to run process: " + e.getMessage()));
        }
        if (!missing.isEmpty()) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new DeployErrorResponse("Missing required variable(s): " + String.join(", ", missing)));
        }
        // Set after copying the caller-supplied map, not merged into it -- this always overwrites
        // whatever the caller sent under this key with the real authenticated principal, so
        // nothing reachable over the API can spoof "who ran this" by including their own
        // "principal" in the request body.
        NtrlocPrincipal principal = principalResolver.resolve(httpRequest, authentication);
        variables.put(NtrlocPrincipalVariableType.PRINCIPAL_VARIABLE, principal);
        try {
            ProcessInstance instance = runtimeService.startProcessInstanceById(id, variables);
            return ResponseEntity.ok(new ProcessInstanceView(instance.getId(), instance.isEnded()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new DeployErrorResponse("Failed to run process: " + e.getMessage()));
        }
    }

    // ioSpecification.dataInputRefs is Flowable's own already-flattened view of what the BPMN XML
    // spells as <inputSet><dataInputRefs>id</dataInputRefs></inputSet> -- an InputSet is a real,
    // separately-addressable element in the spec, but this parsed model collapses straight to a
    // List<String> of required DataSpec ids directly on IOSpecification itself (confirmed against
    // IOSpecification.java: no InputSet class exists in this model at all), matching this
    // codebase's one-inputSet-means-"the required ones" usage rather than the spec's fuller
    // multi-inputSet "alternative valid combinations" machinery. Presence-only: a required
    // variable's *value* isn't type-checked against its declared itemSubjectRef here -- the
    // declared type drives the admin UI's Run-dialog input widgets, not a server-side type gate.
    private List<String> missingRequiredVariables(String processDefinitionId, Map<String, Object> variables) {
        BpmnModel model = repositoryService.getBpmnModel(processDefinitionId);
        IOSpecification ioSpecification = model.getMainProcess().getIoSpecification();
        if (ioSpecification == null) {
            return List.of();
        }
        List<String> missing = new ArrayList<>();
        for (DataSpec dataInput : ioSpecification.getDataInputs()) {
            boolean required = ioSpecification.getDataInputRefs().contains(dataInput.getId());
            if (required && !variables.containsKey(dataInput.getName())) {
                missing.add(dataInput.getName());
            }
        }
        return missing;
    }

    private ProcessDefinitionView toView(ProcessDefinition definition) {
        return new ProcessDefinitionView(definition.getId(), definition.getKey(), definition.getName(),
                definition.getVersion(), definition.getDeploymentId());
    }
}
