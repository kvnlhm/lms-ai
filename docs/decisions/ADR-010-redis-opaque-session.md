# ADR-010: Redis-Backed Opaque Session for Web MVP

## Status

Accepted.

## Context

Web LMS membutuhkan autentikasi aman, session revocation, device management, dan implementasi yang mudah dirawat. Mobile application belum termasuk MVP.

## Decision

Gunakan opaque session ID dalam `HttpOnly`, `Secure`, dan appropriate `SameSite` cookie.

Session state disimpan server-side pada Redis.

## Controls

- Session ID dirotasi setelah login.
- Session dirotasi setelah MFA.
- Session dirotasi setelah perubahan privilege.
- CSRF token wajib untuk mutation.
- Session memiliki idle dan absolute expiration.
- Logout mencabut session server-side.
- Master dapat mencabut seluruh session pengguna tertentu sesuai permission.
- Session cookie tidak dapat dibaca JavaScript.
- Tidak menyimpan JWT pada localStorage.

## Consequences

- Revocation sederhana.
- Risiko token leakage lebih rendah pada browser.
- Redis menjadi dependency kritis untuk authenticated web request.
- Future mobile API dapat menggunakan token strategy terpisah melalui ADR baru.
