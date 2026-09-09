package org.ntrloc.graph.db.partition.security;

import jakarta.annotation.PostConstruct;
import org.ntrloc.graph.db.partition.authorization.DefaultGroupInitializer;
import org.ntrloc.graph.db.partition.security.repository.SecurityRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "graph.security", name = "seed-local-accounts", havingValue = "true")
@DependsOnDatabaseInitialization
public class LocalAccountSeeder {

    private final SecurityRepository repo;
    private final DefaultGroupInitializer defaultGroupInitializer;

    // Constructor-injecting DefaultGroupInitializer (rather than just calling a static constant)
    // is what guarantees ensureGroupExists()'s @PostConstruct has already run by the time init()
    // below fires -- see addUserToDefaultGroup's own comment.
    public LocalAccountSeeder(SecurityRepository repo, DefaultGroupInitializer defaultGroupInitializer) {
        this.repo = repo;
        this.defaultGroupInitializer = defaultGroupInitializer;
    }

    @PostConstruct
    void init() {
        seedAccount("admin", "Local Admin", "admin@local", "admin", "ADMIN");
        seedAccount("localuser", "Local User", "localuser@local", "password", "USER");
    }

    private void seedAccount(String externalId, String displayName, String email, String rawPassword, String role) {
        if (repo.findUserByExternalId(externalId).isPresent()) return;
        boolean isSuperuser = "ADMIN".equals(role);
        var user = repo.createUser(externalId, displayName, email, isSuperuser);
        String passwordHash = "{bcrypt}" + new BCryptPasswordEncoder().encode(rawPassword);
        repo.createLocalCredentials(user.id(), externalId, passwordHash, role);
        defaultGroupInitializer.addUserToDefaultGroup(user.id());
    }
}
