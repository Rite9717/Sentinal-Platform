package com.sentinal.registry.service.auth;


import com.sentinal.registry.dto.auth.LoginRequestDto;
import com.sentinal.registry.dto.auth.LoginResponseDto;
import com.sentinal.registry.dto.auth.RegistrationRequestDto;
import com.sentinal.registry.dto.auth.UserResponseDto;
import com.sentinal.registry.exception.UserAlreadyExistsException;
import com.sentinal.registry.model.user.Role;
import com.sentinal.registry.model.user.User;
import com.sentinal.registry.repository.UserRepository;
import com.sentinal.registry.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService
{
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final CustomUserDetailsService userDetailsService;
    private final JwtUtil jwtUtil;


    public UserResponseDto register(RegistrationRequestDto request)
    {
        if (userRepository.existsByUsername(request.getUsername()))
        {
            throw new UserAlreadyExistsException("Username '" + request.getUsername() + "' is already taken");
        }
        if (userRepository.existsByEmail(request.getEmail()))
        {
            throw new UserAlreadyExistsException("Email '" + request.getEmail() + "' is already registered");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .role(Role.USER)
                .enabled(true)
                .build();

        User saved = userRepository.save(user);
        return toResponseDto(saved);
    }

    public LoginResponseDto login(LoginRequestDto request)
    {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getUsername(), request.getPassword()));

        UserDetails userDetails = userDetailsService.loadUserByUsername(request.getUsername());
        String token = jwtUtil.generateToken(userDetails.getUsername());

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found after authentication"));

        return LoginResponseDto.builder()
                .token(token)
                .type("Bearer")
                .user(toResponseDto(user))
                .build();
    }

    public UserResponseDto toResponseDto(User user)
    {
        return UserResponseDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .enabled(user.isEnabled())
                .createdAt(user.getCreatedAt())
                .build();
    }
}

