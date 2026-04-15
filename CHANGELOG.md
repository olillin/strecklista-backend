# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Group clients
- `POST /oauth2/token` which supports `authorization_code` and `client_credentials` grant types.

### Changed

- **BREAKING:** API Changes:
    - `GET /user`: `balance` has been moved out of `user` in the response.
    - `POST /login` has been replaced with `POST /oauth2/token` with grant type `authorization_code`.
    - `POST /authorize` has been moved to `POST /oauth2/authorize`.
- Improved separation of users and group users with new interfaces.
