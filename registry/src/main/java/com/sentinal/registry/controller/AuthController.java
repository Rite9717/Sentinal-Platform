package com.sentinal.registry.controller;

import com.sentinal.registry.dto.auth.LoginRequestDto;
import com.sentinal.registry.dto.auth.LoginResponseDto;
import com.sentinal.registry.dto.auth.RegistrationRequestDto;
import com.sentinal.registry.dto.auth.UserResponseDto;
import com.sentinal.registry.service.auth.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController
{
    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> register(
            @Valid @RequestBody RegistrationRequestDto request) {
        UserResponseDto response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDto> login(
            @Valid @RequestBody LoginRequestDto request) {
        LoginResponseDto response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/oauth2/info")
    public ResponseEntity<String> oauth2Info() {
        return ResponseEntity.ok(
                "To sign in with Google, redirect your browser to: "
                        + "/oauth2/authorization/google");
    }
}