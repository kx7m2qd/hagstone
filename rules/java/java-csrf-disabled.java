import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

public class SecurityConfigs {
  @Bean
  SecurityFilterChain legacy(HttpSecurity http) throws Exception {
    // ruleid: java-csrf-disabled
    http.csrf().disable().authorizeRequests().anyRequest().authenticated().and().formLogin();
    return http.build();
  }

  @Bean
  SecurityFilterChain lambda(HttpSecurity http) throws Exception {
    // ruleid: java-csrf-disabled
    return http
        .csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(a -> a.anyRequest().authenticated())
        .formLogin(f -> f.loginPage("/login"))
        .build();
  }

  @Bean
  SecurityFilterChain lambda2(HttpSecurity http) throws Exception {
    // ruleid: java-csrf-disabled
    http.csrf(c -> c.disable());
    return http.build();
  }

  @Bean
  SecurityFilterChain statelessApi(HttpSecurity http) throws Exception {
    // ok: java-csrf-disabled
    return http
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(a -> a.anyRequest().authenticated())
        .build();
  }

  @Bean
  SecurityFilterChain statelessLegacy(HttpSecurity http) throws Exception {
    // ok: java-csrf-disabled
    http.csrf().disable();
    http.sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS);
    return http.build();
  }

  @Bean
  SecurityFilterChain statelessFirst(HttpSecurity http) throws Exception {
    // ok: java-csrf-disabled
    return http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(AbstractHttpConfigurer::disable)
        .build();
  }

  @Bean
  SecurityFilterChain enabled(HttpSecurity http) throws Exception {
    // ok: java-csrf-disabled
    return http.csrf(c -> c.ignoringRequestMatchers("/webhooks/**")).build();
  }
}
