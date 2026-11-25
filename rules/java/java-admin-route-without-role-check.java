import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

public class Security {
  @Bean
  SecurityFilterChain chain(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(a -> {
      // ruleid: java-admin-route-without-role-check
      a.requestMatchers("/admin/**").authenticated();
      // ruleid: java-admin-route-without-role-check
      a.requestMatchers("/actuator/**").authenticated();
      // ok: java-admin-route-without-role-check
      a.requestMatchers("/management/**").hasRole("ADMIN");
      // ok: java-admin-route-without-role-check
      a.requestMatchers("/orders/**").authenticated();
      a.anyRequest().authenticated();
    });
    return http.build();
  }
}
