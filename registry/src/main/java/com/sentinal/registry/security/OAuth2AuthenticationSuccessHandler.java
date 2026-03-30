package com.sentinal.registry.security;


import com.sentinal.registry.model.user.Role;
import com.sentinal.registry.model.user.User;
import com.sentinal.registry.repository.UserRepository;
import com.sentinal.registry.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler
{
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.oauth2.redirect-uri:http://localhost:3000/oauth2/callback}")
    private String redirectUri;

    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,Authentication authentication) throws IOException
    {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        String email    = oAuth2User.getAttribute("email");
        String fullName = oAuth2User.getAttribute("name");
        User user = resolveUser(email, fullName);
        String token = jwtUtil.generateToken(user.getUsername());
        String targetUrl = UriComponentsBuilder.fromUriString(redirectUri)
                .queryParam("token", token)
                .build().toUriString();

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    private User resolveUser(String email, String fullName)
    {
        return userRepository.findByEmail(email)
                .orElseGet(() -> {
                    String base = email.split("@")[0].replaceAll("[^a-zA-Z0-9]","_");
                    String username = ensureUniqueUsername(base);
                    User newUser = User.builder()
                            .username(username)
                            .email(email)
                            .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .fullName(fullName !=null ? fullName : username)
                            .role(Role.USER)
                            .enabled(true)
                            .build();

                    return userRepository.save(newUser);
                });
    }

    private String ensureUniqueUsername(String base)
    {
        if(!userRepository.existsByUsername(base)) return base;
        int suffix = 1;
        while (userRepository.existsByUsername(base+suffix)) suffix++;
        return base + suffix;
    }
}
