package com.feynman.backend.service;

import com.feynman.backend.dto.AuthResponse;
import com.feynman.backend.dto.LoginRequest;
import com.feynman.backend.dto.RegisterRequest;
import com.feynman.backend.entity.User;
import com.feynman.backend.exception.EmailAlreadyInUseException;
import com.feynman.backend.exception.InvalidCredentialsException;
import com.feynman.backend.repository.UserRepository;
import com.feynman.backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyInUseException(email);
        }
        User user = new User(email, passwordEncoder.encode(request.password()), request.displayName());
        userRepository.save(user);
        return issueTokens(user);
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();
        User user = userRepository.findByEmail(email)
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(InvalidCredentialsException::new);
        return issueTokens(user);
    }

    public AuthResponse refresh(String refreshToken) {
        UUID userId = jwtService.validateRefreshToken(refreshToken).orElseThrow(InvalidCredentialsException::new);
        User user = userRepository.findById(userId).orElseThrow(InvalidCredentialsException::new);
        return issueTokens(user);
    }

    private AuthResponse issueTokens(User user) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtService.generateRefreshToken(user.getId());
        return new AuthResponse(accessToken, refreshToken, user.getEmail(), user.getDisplayName());
    }
}
