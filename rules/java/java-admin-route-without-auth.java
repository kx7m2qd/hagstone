import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.web.SecurityFilterChain;

public class Security {
  @Bean
  SecurityFilterChain chain(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(a -> {
      // ruleid: java-admin-route-without-auth
      a.requestMatchers("/admin/**").permitAll();
      // ruleid: java-admin-route-without-auth
      a.requestMatchers("/actuator/**").permitAll();
      // ok: java-admin-route-without-auth
      a.requestMatchers("/actuator/health", "/actuator/info").permitAll();
      // ok: java-admin-route-without-auth
      a.requestMatchers("/public/**", "/login").permitAll();
      a.anyRequest().authenticated();
    });
    return http.build();
  }

  @Bean
  SecurityFilterChain legacy(HttpSecurity http) throws Exception {
    // ruleid: java-admin-route-without-auth
    http.authorizeRequests().anyRequest().permitAll();
    return http.build();
  }

  @Bean
  WebSecurityCustomizer ignore() {
    // ruleid: java-admin-route-without-auth
    return web -> web.ignoring().requestMatchers("/management/**");
  }
}
