# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING:** API Changes:
    - `GET /user`: `balance` has been moved out of `user` in the response.
    - `POST /login`: `balance` has been moved out of `user` in the response.
- Improved separation of users and group users with new interfaces.
