package com.example.shop;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class BackofficeSecurity {
  @Bean
  SecurityFilterChain backoffice(HttpSecurity http) throws Exception {
    // Session-cookie login, so CSRF protection is needed.
    // expect: java-csrf-disabled
    return http.csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(a -> {
          a.requestMatchers("/login", "/public/**", "/actuator/health").permitAll();
          // expect: java-admin-route-without-auth
          a.requestMatchers("/actuator/**").permitAll();
          // expect: java-admin-route-without-role-check
          a.requestMatchers("/admin/**").authenticated();
          a.requestMatchers("/management/**").hasRole("ADMIN");
          a.anyRequest().authenticated();
        })
        .formLogin(f -> f.loginPage("/login"))
        .build();
  }
}
