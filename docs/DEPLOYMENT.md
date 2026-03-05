# Deployment

This page will run you through how to deploy the backend to your own server.
Including both initial setup and further configuration.

## Prerequisites

To be able to setup and run the server you will need the following:

- A [Gamma](https://auth.chalmers.it) account
- [Git](https://git-scm.com/downloads)
- [Docker Compose](https://docs.docker.com/compose/install/)
- A text editor
- A terminal

## Getting started

1. [Creating a Gamma client](#creating-a-gamma-client)
2. [Preparing the server](#preparing-the-server)
3. [Starting the server](#starting-the-server)
4. [Initializing the database](#initializing-the-database)

### Creating a Gamma client

The backend requires a Gamma client to authenticate users and provide access to
profile and group information.

1. Go to the Gamma _Your clients_ page at
   <https://auth.chalmers.it/my-clients> and press
   _Create client_, or go to <https://auth.chalmers.it/my-clients/create>.

    ![Gamma "Your clients" menu](./images/gamma-0.png)

2. Fill in your client details. Make sure that _Generate api key_ is
   selected. _Redirect url_ is where your users will be redirected after
   logging in with Gamma so make sure to set this to the callback URL for your
   frontend.

    ![Creating a new client](./images/gamma-1.png)

3. Fill in the rest of the `.env` file with your newly generated credentials
   according to the labels in the image below:

    ![Client created](./images/gamma-2.png)

### Preparing the server

1. Download the `docker-compose.prod.yaml` file from this repository.

2. Fill in the environment variables `GAMMA_CLIENT_ID` and `GAMMA_REDIRECT_URI`
   from your newly created Gamma client.

3. Create a directory `secrets` next to the compose file and create the
   following files and paste your secrets inside:
    - `gamma-client-secret.txt`
    - `gamma-api-authorization.txt`
    - `jwt-secret.txt`: Generate a random string to sign JWTs
    - `postgres-password.txt`: Generate a random database password
    - `database-url.txt`: In the format `postgresql://postgres:DATABASE PASSWORD@db:5432/strecklista`

### Starting the server

Now you are ready to start the server. Run the following command in the
terminal:

```shell
docker compose up -d
```

It may take a while the first time the server starts as the
[images](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image)
are being created.

### Initializing the database

Initialize the database with Prisma.

## Configuration

The server can be configured by providing more
[environment variables](https://en.wikipedia.org/wiki/Environment_variable) in
the `.env` you created earlier. See the list of available settings below.

<a id="file-tip" name="file-tip"></a>

> [!TIP]
> Appending `_FILE` to the name of an environment variable will fetch the
> variable from a text file.
>
> **Example:** If `.env` contains `GAMMA_CLIENT_SECRET_FILE=secrets/gamma-secret.txt`
> then `GAMMA_CLIENT_SECRET` will be set to the content of the file
> `secrets/gamma-secret.txt`. The path is relative to the project root.

### General

| Name           | Type        | Default                                                                                                      | Description                                                                                                                                       |
| -------------- | ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT           | int         | 8080                                                                                                         | Which port the server will listen to.                                                                                                             |
| SUPER_GROUP_ID | UUID(s)     | ID of the [P.R.I.T. super group](https://auth.chalmers.it/super-groups/32da51ec-2854-4bc2-b19a-30dad5dcc501) | Which Gamma super group to allow to use the service, as a comma separated list of super group UUIDs.                                              |
| EXPOSE_CORS    | true\|false | false                                                                                                        | Enable [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) requests for all origins and disable CORS security, not recommended. |
| TRUST_PROXY    | true\|false | false                                                                                                        | Enable 'trust proxy' to fix <https://express-rate-limit.mintlify.app/reference/error-codes#err-erl-unexpected-x-forwarded-for>.                   |

### JWT

| Name           | Type   | Default     | Description                                         |
| -------------- | ------ | ----------- | --------------------------------------------------- |
| JWT_SECRET     | string |             | Used to sign JWTs when users log in                 |
| JWT_ISSUER     | string | strecklista | The issuer of the JWT                               |
| JWT_EXPIRES_IN | int    | 43200       | How many seconds the JWT is valid for after signing |

### Gamma

| Name                    | Type   | Default | Description                                                            |
| ----------------------- | ------ | ------- | ---------------------------------------------------------------------- |
| GAMMA_CLIENT_ID         | string |         | Public identifier of your Gamma client                                 |
| GAMMA_CLIENT_SECRET     | string |         | Secret key of your Gamma client                                        |
| GAMMA_API_AUTHORIZATION | string |         | Gamma API authorization header, should look like `pre-shared: xxxx...` |
| GAMMA_REDIRECT_URI      | URI    |         | Redirect URI of your Gamma client                                      |

### Prisma

| Name         | Type   | Default | Description                                        |
| ------------ | ------ | ------- | -------------------------------------------------- |
| DATABASE_URL | string |         | The URL Prisma will use to connect to the databsae |

> [!WARNING]
> If using Docker Compose the connection to PostgreSQL is already configured and
> should require no additional setup. If you need to configure these variables
> you are likely doing something wrong or already know what you are doing.

The server uses [pg](https://www.npmjs.com/package/pg) to communicate with
PostgreSQL and the same environment variables are used. They can be found at:
<https://www.postgresql.org/docs/current/libpq-envars.html>.

> [!NOTE]
> [docker-compose.yaml](../docker-compose.yaml) defines `PGPASSWORD` and
> `POSTGRES_PASSWORD`. `PGPASSWORD` is the password the backend uses when
> connecting to the database while `POSTGRES_PASSWORD` is the password the
> database is created with. These should be the same and are set to the file
> `secrets/password.txt` by default using the `_FILE` scheme described
> [above](#file-tip).
