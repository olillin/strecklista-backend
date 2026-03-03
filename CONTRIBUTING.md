# CONTRIBUTING

Thank you for your interest in contributing to the strecklista backend!
Contributions are very appreciated, if you are looking for something to help
with check out the
[issues](https://github.com/olillin/strecklista-backend/issues) page.

## Developing

This page will run you through how to develop the project locally.

## Prerequisites

To be able to setup and run the server you will need the following:

- A [Gamma](https://auth.chalmers.it) account
- [NodeJS](https://nodejs.org/en/download)
- [Git](https://git-scm.com/downloads)
- [Docker Compose](https://docs.docker.com/compose/install/)
- A text editor
- A terminal

## Getting started

1. [Creating a Gamma client](#creating-a-gamma-client)
2. [Initial setup](#initial-setup)
3. [Starting the server](#starting-the-server)
4. [Setup the database](#setup-the-database)

### Creating a Gamma client

The backend requires a Gamma client to authenticate users and provide access to
profile and group information.

1. Go to the Gamma _Your clients_ page at
   <https://auth.chalmers.it/my-clients> and press
   _Create client_, or go to <https://auth.chalmers.it/my-clients/create>.

    ![Gamma "Your clients" menu](./docs/images/gamma-0.png)

2. Fill in your client details. Make sure that _Generate api key_ is
   selected. _Redirect url_ is where your users will be redirected after
   logging in with Gamma so make sure to set this to the callback URL for your
   frontend.

    ![Creating a new client](./docs/images/gamma-1.png)

3. Fill in the rest of the `.env` file with your newly generated credentials
   according to the labels in the image below:

    ![Client created](./docs/images/gamma-2.png)

### Initial setup

1. Start by cloning the repository:

    ```shell
    git clone https://github.com/olillin/strecklista-backend
    ```

2. Copy the `.env.example` in the root of the project file to `.env` and fill
   in details about your newly created Gamma client.

3. Generate the Prisma client:

    ```shell
    npx prisma generate
    ```

### Starting the server

Now you are ready to start the server. Run the following command in the
terminal:

```shell
npm run dev
```

This will (re)build the Docker image and start both the server and the
database.

### Setup the database

To create the tables in the database you must run this command:

```console
npx prisma db push
```

The development database is not saved between restarts, you may want to add
development data with the seed:

```console
npx prisma db seed
```

## Configuration

See [DEPLOYMENT](./docs/DEPLOYMENT.md) for more info about configuring the
server.

