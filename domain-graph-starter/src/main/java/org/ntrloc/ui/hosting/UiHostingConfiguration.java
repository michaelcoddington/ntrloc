package org.ntrloc.ui.hosting;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.config.ResourceHandlerRegistry;
import org.springframework.web.reactive.config.WebFluxConfigurer;
import org.springframework.web.server.WebFilter;

@Configuration
@EnableConfigurationProperties(UiHostingProperties.class)
public class UiHostingConfiguration implements WebFluxConfigurer {

    private final UiHostingProperties properties;

    public UiHostingConfiguration(UiHostingProperties properties) {
        this.properties = properties;
    }

    @Bean
    WebFilter mountWelcomePageFilter() {
        return new MountWelcomePageFilter(properties);
    }

    @Bean
    WebFilter staticResourceOffloadFilter() {
        return new StaticResourceOffloadFilter(properties);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        for (UiHostingProperties.Mount mount : properties.mounts()) {
            String path = mount.path().endsWith("/") ? mount.path() : mount.path() + "/";
            String location = mount.location().endsWith("/") ? mount.location() : mount.location() + "/";
            registry.addResourceHandler(path + "**")
                    .addResourceLocations(location)
                    .resourceChain(true)
                    .addResolver(new SpaFallbackResourceResolver());
        }
    }
}
