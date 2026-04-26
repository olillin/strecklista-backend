# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

See the [API docs][api] for specifics on how to use the new and updated endpoints.

### Added

- Group clients and related endpoints.
- External IDs for items and group members:
  Unique for every group.
- New API endpoints:
    - `POST /oauth2/token` which supports `authorization_code` and `client_credentials` grant types.
    - `GET /group/member/\<id\>` which fetches info about a member of the group.
    - `PUT /group/member/\<id\>` which supports updating the `externalId` of a group member.

### Changed

- **BREAKING:** API Changes:
    - `GET /user`: `balance` has been moved out of `user` in the response.
    - `POST /login` has been replaced with `POST /oauth2/token` with grant type `authorization_code`.
    - `POST /authorize` has been moved to `POST /oauth2/authorize`.
    - Transactions have a new format for `createdBy` to allow users and clients to create transactions.
- Improved separation of users and group users with new interfaces.
- `POST /group/purchase` now supports external item and user IDs.

[api]: ./docs/API.md
