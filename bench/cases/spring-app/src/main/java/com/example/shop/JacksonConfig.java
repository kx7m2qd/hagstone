package com.example.shop;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {
  @Bean
  public ObjectMapper objectMapper() {
    ObjectMapper mapper = new ObjectMapper();
    // Lets clients send subclasses of Event; also lets them name any class on the classpath.
    // expect: java-jackson-polymorphic-typing
    mapper.enableDefaultTyping();
    return mapper;
  }
}
