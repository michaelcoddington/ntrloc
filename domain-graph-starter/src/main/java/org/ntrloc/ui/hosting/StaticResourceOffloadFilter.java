package org.ntrloc.ui.hosting;

import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

// PathResourceResolver (and SpaFallbackResourceResolver, which extends it) resolves each request
// via ClassPathResource/File -- isReadable(), resolveURL(), File.exists() -- all blocking calls,
// with no offloading of its own. UiHostingConfiguration.resourceChain(true) caches a resolution
// after the first successful lookup, but the first request for any given path each time the app
// restarts still runs that blocking chain directly on the Netty event-loop thread, same as every
// later cache miss. A WebFilter subscribing the downstream chain on boundedElastic moves that
// work off the event loop unconditionally, cached or not.
public class StaticResourceOffloadFilter implements WebFilter {

    private final UiHostingProperties properties;

    public StaticResourceOffloadFilter(UiHostingProperties properties) {
        this.properties = properties;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();

        boolean isMountedAsset = properties.mounts().stream().anyMatch(mount -> {
            String mountPath = mount.path().endsWith("/") ? mount.path() : mount.path() + "/";
            return path.startsWith(mountPath);
        });

        return isMountedAsset
                ? chain.filter(exchange).subscribeOn(Schedulers.boundedElastic())
                : chain.filter(exchange);
    }
}
