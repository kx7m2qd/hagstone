import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonTypeInfo.Id;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;

public class Mappers {
  ObjectMapper legacy() {
    ObjectMapper m = new ObjectMapper();
    // ruleid: java-jackson-polymorphic-typing
    m.enableDefaultTyping();
    return m;
  }

  ObjectMapper permissive() {
    ObjectMapper m = new ObjectMapper();
    // ruleid: java-jackson-polymorphic-typing
    m.activateDefaultTyping(LaissezFaireSubTypeValidator.instance, ObjectMapper.DefaultTyping.NON_FINAL);
    return m;
  }

  ObjectMapper validated() {
    ObjectMapper m = new ObjectMapper();
    BasicPolymorphicTypeValidator ptv =
        BasicPolymorphicTypeValidator.builder().allowIfSubType("com.example.events.").build();
    // ok: java-jackson-polymorphic-typing
    m.activateDefaultTyping(ptv, ObjectMapper.DefaultTyping.NON_FINAL);
    return m;
  }

  static class Envelope {
    // ruleid: java-jackson-polymorphic-typing
    @JsonTypeInfo(use = JsonTypeInfo.Id.CLASS, property = "@class")
    Object payload;
  }

  // ruleid: java-jackson-polymorphic-typing
  @JsonTypeInfo(use = Id.MINIMAL_CLASS)
  abstract static class Shape {}

  // ok: java-jackson-polymorphic-typing
  @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
  @JsonSubTypes({@JsonSubTypes.Type(value = Circle.class, name = "circle")})
  abstract static class Event {}

  static class Circle extends Event {}
}
