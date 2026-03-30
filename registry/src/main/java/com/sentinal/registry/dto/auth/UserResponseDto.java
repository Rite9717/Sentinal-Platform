package com.sentinal.registry.dto.auth;


import com.sentinal.registry.model.user.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponseDto {
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private Role role;
    private boolean enabled;
    private LocalDateTime createdAt;
}
