package org.ntrloc.graph.db.partition.security;

import org.ntrloc.graph.db.partition.authorization.DefaultGroupInitializer;
import org.ntrloc.graph.db.partition.security.repository.SecurityRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/groups")
public class GroupAdminController {

    private static final String GROUP_NOT_FOUND = "Group not found";

    // parentIds is every group this one is directly nested under -- the schema (security_group_
    // member_group) technically allows more than one, but the admin UI only ever offers a single
    // parent picker, so in practice this list has 0 or 1 entries for anything created there.
    public record GroupView(UUID id, String name, int memberCount, List<UUID> parentIds) {}

    public record CreateGroupRequest(String name, UUID parentGroupId) {}

    public record UpdateGroupRequest(String name) {}

    public record UpdateParentRequest(UUID parentGroupId) {}

    public record MemberView(UUID id, String externalId, String displayName, String email, boolean isSuperuser) {}

    public record AddMemberRequest(UUID userId) {}

    private final SecurityRepository repo;
    private final PrincipalResolver principalResolver;
    private final DefaultGroupInitializer defaultGroupInitializer;

    public GroupAdminController(SecurityRepository repo, PrincipalResolver principalResolver,
                                DefaultGroupInitializer defaultGroupInitializer) {
        this.repo = repo;
        this.principalResolver = principalResolver;
        this.defaultGroupInitializer = defaultGroupInitializer;
    }

    @GetMapping
    List<GroupView> listGroups(ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        return repo.listGroups().stream()
                .map(this::toView)
                .toList();
    }

    // "everyone" is the one and only top-level group -- it's seeded directly by
    // DefaultGroupInitializer at boot, never through this endpoint, so every group created here
    // must nest under something (ultimately "everyone" itself, directly or transitively). Without
    // this check the admin UI's old parent picker ("(Top level)" alongside "everyone") could create
    // a second, sibling root that the tree had no sensible way to relate to "everyone".
    @PostMapping
    GroupView createGroup(@RequestBody CreateGroupRequest body, ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        if (body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Group name is required");
        }
        if (body.parentGroupId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A parent group is required -- 'everyone' is the only top-level group");
        }
        if (repo.findGroupByName(body.name().trim()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Group already exists: " + body.name());
        }
        repo.findGroupById(body.parentGroupId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent group not found"));
        var group = repo.createGroup(body.name().trim());
        repo.addGroupToGroup(group.id(), body.parentGroupId());
        return toView(group);
    }

    @PutMapping("/{groupId}")
    GroupView updateGroup(@PathVariable("groupId") UUID groupId, @RequestBody UpdateGroupRequest body,
                          ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        repo.findGroupById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, GROUP_NOT_FOUND));
        if (body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Group name is required");
        }
        var updated = repo.updateGroup(groupId, body.name().trim());
        return toView(updated);
    }

    // Sets this group's single parent, replacing whatever it was nested under before. A null
    // parentGroupId is rejected -- "everyone" is the only group allowed to have no parent (see
    // createGroup's own comment), and it's seeded directly by DefaultGroupInitializer rather than
    // ever passing through this endpoint, so there's no legitimate caller that needs to clear a
    // group's parent entirely. The admin UI's tree only ever shows/edits one parent per group (see
    // GroupView's own comment), so "reparent" here means "clear every existing containing-group
    // edge, then add the new one" rather than a general multi-parent add/remove; that's still
    // exactly what the DAG-shaped schema underneath allows, just used in a restricted way.
    @PutMapping("/{groupId}/parent")
    GroupView updateParent(@PathVariable("groupId") UUID groupId, @RequestBody UpdateParentRequest body,
                           ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        var group = repo.findGroupById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, GROUP_NOT_FOUND));
        if (body.parentGroupId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A parent group is required -- 'everyone' is the only top-level group");
        }
        repo.findGroupById(body.parentGroupId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent group not found"));
        for (var existingParent : repo.listContainingGroups(groupId)) {
            repo.removeGroupFromGroup(groupId, existingParent.id());
        }
        try {
            repo.addGroupToGroup(groupId, body.parentGroupId());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        return toView(group);
    }

    private GroupView toView(SecurityRepository.GroupRow g) {
        var parentIds = repo.listContainingGroups(g.id()).stream().map(SecurityRepository.GroupRow::id).toList();
        return new GroupView(g.id(), g.name(), repo.listGroupMembers(g.id()).size(), parentIds);
    }

    @DeleteMapping("/{groupId}")
    ResponseEntity<Void> deleteGroup(@PathVariable("groupId") UUID groupId,
                                     ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        if (groupId.equals(defaultGroupInitializer.getDefaultGroupId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot delete the default group");
        }
        repo.findGroupById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, GROUP_NOT_FOUND));
        repo.deleteGroup(groupId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/members")
    List<MemberView> listMembers(@PathVariable("groupId") UUID groupId,
                                 ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        repo.findGroupById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, GROUP_NOT_FOUND));
        return repo.listGroupMembers(groupId).stream()
                .map(u -> new MemberView(u.id(), u.externalId(), u.displayName(), u.email(), u.isSuperuser()))
                .toList();
    }

    @PostMapping("/{groupId}/members")
    ResponseEntity<Void> addMember(@PathVariable("groupId") UUID groupId, @RequestBody AddMemberRequest body,
                                   ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        repo.findGroupById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, GROUP_NOT_FOUND));
        repo.addUserToGroup(body.userId(), groupId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{groupId}/members/{userId}")
    ResponseEntity<Void> removeMember(@PathVariable("groupId") UUID groupId, @PathVariable("userId") UUID userId,
                                      ServerHttpRequest request, Authentication authentication) {
        requireAdmin(request, authentication);
        repo.removeUserFromGroup(userId, groupId);
        return ResponseEntity.noContent().build();
    }

    private void requireAdmin(ServerHttpRequest request, Authentication authentication) {
        var principal = principalResolver.resolve(request, authentication);
        if (!principal.isSuperuser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can manage groups");
        }
    }
}
