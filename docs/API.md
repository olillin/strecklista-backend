# Strecklista API documentation

## Index

1. [General](#general)  
   1.1 [API Endpoints Overview](#api-endpoints)  
   1.2 [API Responses](#api-responses)  
   1.3 [General Errors](#general-errors)

2. [Types](#types)  
   2.1 [UserId](#userid)  
   2.2 [GroupId](#groupid)  
   2.3 [User](#user)  
   2.4 [Group](#group)  
   2.5 [Item](#item)  
   2.6 [Price](#price)  
   2.7 [Transaction](#transaction)  
   2.8 [Purchase](#purchase)  
   2.9 [PurchasedItem](#purchaseditem)  
   2.10 [Deposit](#deposit)  
   2.11 [StockUpdate](#stockupdate)  
   2.12 [ItemStockUpdate](#itemstockupdate)

3. [Authorization](#authorization)  
   3.1 [Authorization Flow](#authorization-flow)  
   3.2 [GET /oauth2/authorize](#get-oauth2-authorize)  
   3.3 [POST /oauth2/token](#post-oauth2-token)

4. [API Endpoints](#api-endpoints)  
   4.1 [GET /user](#get-user)  
   4.2 [GET /group](#get-group)  
   4.3 [GET /group/member/\<id\>](#get-group-memberid)  
   4.4 [PUT /group/member/\<id\>](#put-group-memberid)  
   4.5 [GET /group/transaction](#get-grouptransaction)  
   4.6 [GET /group/transaction/\<id\>](#get-grouptransactionid)  
   4.7 [PATCH /group/transaction/\<id\>](#patch-grouptransactionid)  
   4.8 [POST /group/purchase](#post-grouppurchase)  
   4.9 [POST /group/deposit](#post-groupdeposit)  
   4.10 [POST /group/stock](#post-groupstock)  
   4.11 [GET /group/item](#get-groupitem)  
   4.12 [POST /group/item](#post-groupitem)  
   4.13 [GET /group/item/\<id\>](#get-groupitemid)  
   4.14 [PATCH /group/item/\<id\>](#patch-groupitemid)  
   4.15 [DELETE /group/item/\<id\>](#delete-groupitemid)
   4.16 [GET /group/client](#get-group-client)
   4.17 [POST /group/client](#post-group-client)
   4.18 [GET /group/client/client/\<id\>](#get-group-clientid)
   4.19 [DELETE /group/client/client/\<id\>](#delete-group-clientid)

## General

### API Endpoints

All endpoints in this file are relative to <https://strecklista.chalmers.it/api>

### API Responses

All API responses are in JSON format. If the request was successful the response will look like this and contain a data object:

```javascript
{
  "data": <response data here>
}
```

However if an error occurs the request will not contain a data object and instead contain an error:

```javascript
{
  "error": {
    "code": <HTTP error code as int>
    "message": "<error message>"
  }
}
```

### General Errors

| Code | Message                                                                              |
| ---- | ------------------------------------------------------------------------------------ |
| 400  | Invalid user ID                                                                      |
| 404  | User does not exist                                                                  |
| 400  | Invalid item ID                                                                      |
| 404  | Item does not exist                                                                  |
| 400  | Invalid transaction ID                                                               |
| 404  | Transaction does not exist                                                           |
| 400  | URL is invalid                                                                       |
| 400  | Missing required property '\<name\>' in \<location\>                                 |
| 400  | Property '\<name\>' is invalid in \<location\>                                       |
| 401  | Unauthorized                                                                         |
| 403  | User does not have permission to access this service                                 |
| 500  | An unexpected error occurred. Please create an issue on GitHub. Details: \<details\> |
| 502  | Received invalid response from gamma                                                 |
| 504  | Unable to reach gamma                                                                |

## Types

### UserId

UUID of a user in gamma.

### GroupId

UUID of a group in gamma.

### User

```javascript
{
  "id": int, // Numeric auto-incrementing user id
  "gammaId": UserId, // Gamma user id
  "firstName": string,
  "lastName": string,
  "nick": string,
  "avatarUrl": string,
}
```

### Group

```javascript
{
  "id": int, // Numeric auto-incrementing group id
  "gammaId": GroupId, // Gamma group id
  "prettyName": string,
  "avatarUrl": string,
}
```

### GroupUser

```javascript
{
  "user": User,
  "group": Group,
  "balance": decimal,
}
```

### GroupMember

```javascript
{
  "id": int, // Numeric auto-incrementing user id
  "gammaId": UserId, // Gamma user id
  "firstName": string,
  "lastName": string,
  "nick": string,
  "avatarUrl": string,
  "balance": decimal,
}
```

### Item

```javascript
{
  "id": int, // Numeric auto-incrementing item id
  "addedTime": int, // Timestamp where this item was created in ms
  "icon": string?, // URL to the item icon
  "displayName": string,
  "prices": Price[],
  "stock": int, // How many of the item is available
  "timesPurchased": int,
  "visible": boolean, // If this item is visible
  "favorite": boolean, // If the logged in user has favorited this item
}
```

### Price

```javascript
{
  "price": decimal, // Price in SEK
  "displayName": string,
  "externalId": int?
}
```

### Transaction

```javascript
{
  "type": string,
  "id": int, // Numeric auto-incrementing id
  "createdBy": int, // Id of the user who created the transaction
  "createdTime": int, // Timestamp when this transaction was created in ms
  "removed": boolean, // The transaction is ignored for calculations such as user balances and item stock counts and it may be presented differently on the frontend
  "comment": string? // Optional comment
}
```

### Purchase

extends [Transaction](#transaction)

```javascript
{
  "type": "purchase",
  "createdFor": int, // Id of the user who the transaction applies to
  "items": PurchasedItem[]
}
```

### PurchasedItem

```javascript
{
  "item": {
    "id": int?,
    "displayName": string,
    "icon": string?
  },
  "quantity": int,
  "purchasePrice": Price
}
```

### Deposit

extends [Transaction](https://docs.google.com/document/d/1KiCo3THSqslC1P8mMXRVONOrT_bQvYtZV1Pq-U-a90g/edit?pli=1&tab=t.0#heading=h.q6qxtz6h8p1q)

```javascript
{
  "type": "deposit",
  "createdFor": int, // Id of the user who the transaction applies to
  "total": decimal // Deposit amount in SEK
}
```

### StockUpdate

extends [Transaction](#transaction)

```javascript
{
  "type": "stockUpdate",
  "items": [
    {
      "id": int,
      "before": int,
      "after": int
    }
  ]
}
```

### ItemStockUpdate

```javascript
{
  "id": int,       // The item id
  "quantity": int, // How much to change the stock by
  "absolute": bool // Set stock to 'quantity' instead of adding it. Defaults to false
}
```

### GroupClient

```javascript
{
  "id": string,
  "scope": string,
  "group": Group,
  "owner": User,
  "displayName": string,
  "description": string?
}
```

## Authorization

### Authorization flow

1. User goes to <https://strecklista.chalmers.it/api/oauth2/authorize>.

2. User is redirected to the Gamma login screen.

3. After logging in the user will be sent to the callback with a Gamma authorization code:  
   `https://strecklista.chalmers.it/callback?code=<gamma code>`

4. The client page sends the `code` from Gamma in a `POST` request to:  
   `https://strecklista.chalmers.it/api/oauth2/token`

5. The server validates the code and user and then responds with a JWT token.

6. The client saves the token (in cookies/session storage) for later use.

7. In future requests the token is sent in the `Authorization` header as a bearer token:  
   `Authorization: Bearer <JWT token>`

### GET /oauth2/authorize

Redirect to Gamma login page. After logging in the user will be redirected to:

`https://strecklista.chalmers.it/callback`

### POST /oauth2/token

Get a token using an authorization code from Gamma or client credentials.

#### Request

##### Authorization code flow

Provide the authorization code in the request body like this:

```json
{
    "grant_type": "authorization_code",
    "code": "<authorization code>"
}
```

##### Client Credentials Flow

```json
{
    "grant_type": "client_credentials",
    "client_id": "<your client id>",
    "client_secret": "<your client secret>"
}
```

Client ID and secret may also be sent as a
[Basic Auth header](https://en.wikipedia.org/wiki/Basic_access_authentication).

#### Response

##### Authorization Code Flow

The generated JWT token and data about the authenticated user and their group.

```javascript
{
  "access_token": <JWT token string>,
  "token_type": "Bearer",
  "sub": string, // User id in the strecklista
  "iss": string, // Issuer of the token (identifier of the Strecklista backend)
  "iat": number, // Unix timestamp in seconds when token was issued
  "nbf": number, // Unix timestamp in seconds when token starts being valid
  "exp": number, // Unix timestamp in seconds when token will expire
  "jti": string, // Unique identifier of the token
  "user": User,
  "group": Group,
  "balance": decimal
}
```

##### Client Credentials Flow

```javascript
{
  "access_token": <JWT token string>,
  "token_type": "Bearer",
  "aud": string, // Intended audience (your client id)
  "iss": string, // Issuer of the token (identifier of the Strecklista backend)
  "iat": number, // Unix timestamp in seconds when token was issued
  "nbf": number, // Unix timestamp in seconds when token starts being valid
  "exp": number, // Unix timestamp in seconds when token will expire
  "jti": string, // Unique identifier of the token
  "scope": string, // Authorized client scopes
  "client": {
    "clientId": string,
    "displayName": string
  },
  "group": {
      "id": number,
      "gammaId": string
  }
}
```

#### Errors

##### Authorization Code Flow

| Code | Message                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| 403  | Unsupported grant type, expected one of authorization_code, client_credentials |
| 404  | Unable to find user in gamma                                                   |
| 500  | Failed to sign JWT: \<details\>                                                |
| 502  | Failed to get token from Gamma, your authorization code may be invalid         |

##### Client Credentials Flow

| Code | Message                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| 401  | Invalid credentials                                                            |
| 403  | Unsupported grant type, expected one of authorization_code, client_credentials |
| 500  | Failed to sign JWT: \<details\>                                                |

## API Endpoints

### GET /user

Get info about the currently authenticated user.

#### Response

Data about the user and their group as [GroupUser](#groupuser).

##### Example

```javascript
{
  "data": {
    "user": {
      "id": 1,
      "gammaId": "2f63a363-af22-480d-be49-531c1831933c",
      "nick": "Dough",
      "firstName": "Jane",
      "lastName": "Doe",
      "avatarUrl": "https://auth.chalmers.it/images/2f63a363-af22-480d-be49-531c1831933c"
    },
    "group": {
      "id": 1,
      "gammaId": "3cf94646-2412-4896-bba9-5d2410ac0c62",
      "avatarUrl": "https://auth.chalmers.it/images/3cf94646-2412-4896-bba9-5d2410ac0c62",
      "prettyName": "P.R.I.T. 25"
    },
    "balance": 0,
  }
}
```

### GET /group

Get info about the group of the currently authenticated user.

#### Response

The group and it's members:

```javascript
{
  "data": {
    "group": Group,
    "members": GroupMember[]
  }
}
```

##### Example

```javascript
{
  "data": {
    "group": {
      "id": 1,
      "gammaId": "3cf94646-2412-4896-bba9-5d2410ac0c62",
      "avatarUrl": "https://auth.chalmers.it/images/group/avatar/3cf94646-2412-4896-bba9-5d2410ac0c62",
      "prettyName": "P.R.I.T. 25"
    },
    "members": [
      {
        "balance": 0,
        "id": 1,
        "gammaId": "2f63a363-af22-480d-be49-531c1831933c",
        "nick": "Dough",
        "firstName": "Jane",
        "lastName": "Doe",
        "avatarUrl": "https://auth.chalmers.it/images/user/avatar/2f63a363-af22-480d-be49-531c1831933c"
      },
      {
        "balance": 0,
        "id": 1,
        "gammaId": "9acb43d4-42f3-4f9d-9f37-bc156463e1a5",
        "nick": "Smithed",
        "firstName": "John",
        "lastName": "Smith",
        "avatarUrl": "https://auth.chalmers.it/images/user/avatar/9acb43d4-42f3-4f9d-9f37-bc156463e1a5"
      }
    ]
  }
}
```

### GET /group/member/\<id\>

Get info about a member of the group.

#### Response

Data about the user and their group as [GroupUser](#groupuser).

##### Example

```javascript
{
  "data": {
    "user": {
      "id": 1,
      "gammaId": "2f63a363-af22-480d-be49-531c1831933c",
      "nick": "Dough",
      "firstName": "Jane",
      "lastName": "Doe",
      "avatarUrl": "https://auth.chalmers.it/images/2f63a363-af22-480d-be49-531c1831933c"
    },
    "group": {
      "id": 1,
      "gammaId": "3cf94646-2412-4896-bba9-5d2410ac0c62",
      "avatarUrl": "https://auth.chalmers.it/images/3cf94646-2412-4896-bba9-5d2410ac0c62",
      "prettyName": "P.R.I.T. 25"
    },
    "balance": 0,
  }
}
```

### PUT /group/member/\<id\>

Update a member of the group.

#### Response

Data about the user and their group as [GroupUser](#groupuser).

##### Example

```javascript
{
  "data": {
    "user": {
      "id": 1,
      "gammaId": "2f63a363-af22-480d-be49-531c1831933c",
      "nick": "Dough",
      "firstName": "Jane",
      "lastName": "Doe",
      "avatarUrl": "https://auth.chalmers.it/images/2f63a363-af22-480d-be49-531c1831933c"
    },
    "group": {
      "id": 1,
      "gammaId": "3cf94646-2412-4896-bba9-5d2410ac0c62",
      "avatarUrl": "https://auth.chalmers.it/images/3cf94646-2412-4896-bba9-5d2410ac0c62",
      "prettyName": "P.R.I.T. 25"
    },
    "balance": 0,
    "externalId": 978020137962
  }
}
```

### GET /group/transaction

List transactions in currently authenticated user's group.

#### Parameters

| Name       | Required | Type                 | Description                                                 |
| ---------- | -------- | -------------------- | ----------------------------------------------------------- |
| limit      | N        | number (default: 50) | How many purchases to list at most                          |
| offset     | N        | number (default: 0)  | How many purchases to skip over in the start                |
| createdBy  | N        | number               | Include only transactions created by the user with this id  |
| createdFor | N        | number               | Include only transactions created for the user with this id |

> [!NOTE]
> Filtering with `createdFor` will never return stock updates as these are not
> considered to be created for a user.

#### Response

A paginated list of transactions with the newest first.  
Unless offset is 0 a _previous_ url is provnded to get the previous page of the list with the same limit or lower.  
Unless at the end of the list a _next_ url is provided to get the next page of the list with the same limit.

```javascript
{
  "data": {
    "transactions": Transaction[],
    "next": string?, // URL to request for next page
    "previous": string? // URL to request for next page
  }
}
```

##### Example

```javascript
{
  "data": {
    "transactions": [
      {
        "type": "purchase",
        "id": 6,
        "purchaseTime": 1738594127,
        "createdBy": 1,
        "createdFor": 1,
        "items": [
          {
            "id": 954210554821,
            "count": 1
          }
        ],
        "removed": true
      },
      {
        "type": "purchase",
        "id": 5,
        "purchaseTime": 1738594001,
        "createdBy": 1,
        "createdFor": 2,
        "items": [
          {
            "id": 954210554821,
            "count": 3
          },
          {
            "id": 754210554621,
            "count": 1
          }
        ],
        "removed": false,
        "comment": "Göken asked me to"
      },
      {
        "type": "deposit",
        "id": 4,
        "createdTime": 1738583085,
        "createdBy": 1,
        "createdFor": 1,
        "total": 488.90,
        "removed": false
      }
    ],
    "next": "https://strecklista.chalmers.it/api/group/purchases?limit=2&offset=6",
    "previous": "https://strecklista.chalmers.it/api/group/purchases?limit=2&offset=2"
  }
}
```

#### Errors

| Code | Error                                      |
| ---- | ------------------------------------------ |
| 400  | Limit must be an integer between 1 and 100 |
| 400  | Offset must be a positive integer          |

### GET /group/transaction/\<id\>

Get a specific transaction.

#### Response

```javascript
{
  "data": {
    "transaction": Transaction
  }
}
```

#### Errors

| Code | Error                      |
| ---- | -------------------------- |
| 400  | Invalid transaction ID     |
| 404  | Transaction does not exist |

### PATCH /group/transaction/<id\>

Update an existing transaction.

#### Body

| Name    | Required | Type    | Description                                                                               |
| ------- | -------- | ------- | ----------------------------------------------------------------------------------------- |
| removed | N        | boolean | If true, the transaction will be ignored in calculations of user balances and item stocks |

#### Response

The transaction after the update:

```javascript
{
  "data": {
    "transaction": Transaction
  }
}
```

##### Example

```javascript
{
  "data": {
    "transaction": {
      "type": "purchase",
      "id": 7,
      "createdTime": 1738594127,
      "createdBy": 1,
      "createdFor": 1,
      "items": [
        {
          "id": 3,
          "count": 1
        }
      ],
      "removed": true
    }
  }
}
```

#### Errors

| Code | Error                      |
| ---- | -------------------------- |
| 400  | Invalid transaction ID     |
| 404  | Transaction does not exist |

### POST /group/purchase

Add a new purchase to a user. The user making the purchase is saved from auth.

#### Body

| Name    | Required | Type                                                      | Description                     |
| ------- | -------- | --------------------------------------------------------- | ------------------------------- |
| userId  | Y        | Numeric user id                                           | The user to add the purchase to |
| items   | Y        | { “id”: int, “quantity”: int “purchasePrice”: Price }\[\] | The items to purchase           |
| comment | N        | string                                                    | An optional comment             |

#### Response

The newly created transaction:

```javascript
{
  "data": {
    "transaction": Purchase
    "balance": decimal // User's balance after transaction
  }
}
```

##### Example

```javascript
{
  "data": {
    "transaction": {
      "type": "purchase",
      "id": 7,
      "createdTime": 1738594127,
      "createdBy": 1,
      "createdFor": 1,
      "items": [
        {
          "id": 3,
          "count": 1
        }
      ],
      "removed": false
    },
    "balance": -19
  }
}
```

#### Errors

| Code | Error                                           |
| ---- | ----------------------------------------------- |
| 400  | Item count must be greater than 0               |
| 400  | Must purchase at least one item                 |
| 400  | Comment must not be longer than 1000 characters |
| 403  | Cannot purchase a non-visible item              |
| 404  | User does not exist                             |
| 404  | Item does not exist                             |

### POST /group/deposit

#### Body

| Name    | Required | Type            | Description                                  |
| ------- | -------- | --------------- | -------------------------------------------- |
| userId  | Y        | Numeric user id | The user to add the deposit to               |
| total   | Y        | decimal         | How much to add to the user's balance in SEK |
| comment | N        | string          | An optional comment                          |

#### Response

The newly created transaction:

```javascript
{
  "data": {
    "transaction": Deposit
    "balance": decimal // User's balance after transaction
  }
}
```

##### Example

```javascript
{
  "data": {
    "transaction": {
      "type": "deposit",
      "id": 7,
      "total": 532.0,
      "removed": false
    },
    "balance": -23.5
  }
}
```

#### Errors

| Code | Error                  |
| ---- | ---------------------- |
| 400  | Total must be a number |
| 404  | User does not exist    |

### POST /group/stock

Create a new [stock update](#stockupdate).

#### Body

| Name    | Required | Type                                  | Description         |
| ------- | -------- | ------------------------------------- | ------------------- |
| items   | Y        | [ItemStockUpdate](#itemstockupdate)[] |                     |
| comment | N        | string                                | An optional comment |

#### Response

The newly created transaction:

```javascript
{
  "data": {
    "transaction": StockUpdate
  }
}
```

##### Example

```javascript
{
  "data": {
    "transaction": {
      "type": "stockUpdate",
      "items": [
        {
          "id": 1,
          "before": 0,
          "after": 20
        },
        {
          "id": 2,
          "before": 3,
          "after": 80
        }
      ],
      "removed": false
    }
  }
}
```

#### Errors

| Code | Error                              |
| ---- | ---------------------------------- |
| 404  | Item with id \<id\> does not exist |

### GET /group/item

List available items for the group

#### Parameters

| Name        | Required | Type                                                                                | Description                                  |
| ----------- | -------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| sort        | N        | _One of these strings:_ popular (default) cheap expensive new old name_a2z name_z2a | How to sort products                         |
| visibleOnly | N        | bool (default: true)                                                                | Whether or not to exclude invisible products |

#### Response

A list of items sorted depending on the sort parameter.

##### Example

```javascript
{
  "data": {
    "items": [
      {
        "id": 3,
        "createdTime": 1738564532,
        "displayName": "Läsk",
        "prices": [
          {
            "displayName": "Extern",
            "price": 12.0,
          }
        ],
        "stock": 19,
        "timesPurchased": 3,
        "visible": true,
        "favorite": true
      },
      {
        "id": 4,
        "createdTime": 1738584035,
        "icon": "https://example.com/product-images/cider.png",
        "displayName": "Cider",
        "prices": [
          {
            "displayName": "Patet",
            "price": 15.0,
          }
        ],
        "stock": 5,
        "timesPurchased": 2,
        "visible": false,
        "favorite": false
      }
    ]
  }
}
```

#### Errors

| Code | Error              |
| ---- | ------------------ |
| 400  | Unknown sort order |

### POST /group/item

Create a new item

#### Body

| Name        | Required | Type                | Description                |
| ----------- | -------- | ------------------- | -------------------------- |
| displayName | Y        | string              | The item name to display   |
| prices      | Y        | [Price](#price)\[\] | Prices for the item in SEK |
| icon        | N        | string              | The URL of the item icon   |

#### Response

Responds with the created item (same response as [GET /group/item/\<id\>](#get-groupitemid))

#### Errors

| Code | Error                                |
| ---- | ------------------------------------ |
| 400  | An item must have at least one price |
| 403  | Display name is not unique           |

### GET /group/item/\<id\>

Get info about an item.

#### Response

```javascript
{
  "data": {
    "item": Item
  }
}
```

##### Example

```javascript
{
  "data": {
    "item": {
      "id": 3,
      "createdTime": 1738564532,
      "icon": "https://example.com/product-images/fanta-exotic.png",
      "displayName": "Läsk",
      "prices": [
        {
          "displayName": "Internt",
          "price": 7.0,
        }
      ],
      "stock": 19,
      "timesPurchased": 3,
      "visible": true,
      "favorite": false
    }
  }
}
```

#### Errors

| Code | Error               |
| ---- | ------------------- |
| 400  | Invalid item ID     |
| 404  | Item does not exist |

### PATCH /group/item/\<id\>

Update an existing item.

> [!TIP]
> For updating the `stock` of an item, see [POST /group/stock](#post-groupstock).

#### Body

| Name        | Required | Type                | Description                                                    |
| ----------- | -------- | ------------------- | -------------------------------------------------------------- |
| icon        | N        | string              | The URL of the item icon                                       |
| displayName | N        | string              | The name to display next to the item                           |
| prices      | N        | [Price](#price)\[\] | Prices for the item in SEK                                     |
| visible     | N        | bool                | Whether or not to show this item                               |
| favorite    | N        | bool                | Whether or not this is a favorite item for the authorized user |

#### Response

The item after the update (same as [GET /group/item/\<id\>](https://docs.google.com/document/d/1KiCo3THSqslC1P8mMXRVONOrT_bQvYtZV1Pq-U-a90g/edit?pli=1&tab=t.0#heading=h.xg7vdnf0jesz))

#### Errors

| Code | Error                      |
| ---- | -------------------------- |
| 403  | Display name is not unique |
| 404  | Item does not exist        |

### DELETE /group/item/\<id\>

Delete an item

#### Errors

| Code | Error               |
| ---- | ------------------- |
| 404  | Item does not exist |

### GET /group/client/\<id\>

Get a group client.

#### Errors

| Code | Error                 |
| ---- | --------------------- |
| 404  | Client does not exist |

#### Response

The client without the secret.

```javascript
{
  "data": {
    "id": string,
    "scope": string,
    "group": Group,
    "owner": User,
    "displayName": string,
    "description": string?
  }
}
```

### GET /group/client

List group clients in the group.

#### Response

```javascript
{
  "data": {
    "clients": GroupClient[]
  }
}
```

##### Example

```javascript
{
  "data": {
    "clients": [
      {
        "id": "01KP4C3XYVZNCQRAQ8D9MX21QK",
        "scope": "items.read transactions.write",
        "group": {
          "id": 1,
          "gammaId": "3cf94646-2412-4896-bba9-5d2410ac0c62",
          "prettyName": "P.R.I.T. 25",
          "avatarUrl": "https://auth.chalmers.it/images/group/avatar/3cf94646-2412-4896-bba9-5d2410ac0c62"
        },
        "owner": {
          "id": 1,
          "gammaId": "2f63a363-af22-480d-be49-531c1831933c",
          "firstName": "Jane",
          "lastName": "Doe",
          "nick": "Dough",
          "avatarUrl": "https://auth.chalmers.it/images/user/avatar/2f63a363-af22-480d-be49-531c1831933c"
        },
        "displayName": "P.R.I.T. Scanner",
        "description": "Beep beep!!"
      }
    ]
  }
}
```

### POST /group/client

Create a new group client.

#### Body

| Name        | Required | Type   | Description                |
| ----------- | -------- | ------ | -------------------------- |
| scope       | Y        | string | Scopes separated by spaces |
| displayName | Y        | string | The client name to display |
| description | N        | string | An optional description    |

#### Response

Responds with the created client and credentials.

```javascript
{
  "data": {
    "client": {
      "secret": string,
      "id": string,
      "scope": string,
      "group": Group,
      "owner": User,
      "displayName": string,
      "description": string?
    }
  }
}
```

##### Example

```javascript
{
  "data": {
    "client": {
      "secret": "MIR5EUJQ7TOJI2M7BM987A9R9JGLBQML19A8S6S9CIOBRSG2ECCG",
      "id": "01KP4C3XYVZNCQRAQ8D9MX21QK",
      "scope": "items.read transactions.write",
      "group": {
        "id": 1,
        "gammaId": "3cf94646-2412-4896-bba9-5d2410ac0c62",
        "prettyName": "P.R.I.T. 25",
        "avatarUrl": "https://auth.chalmers.it/images/group/avatar/3cf94646-2412-4896-bba9-5d2410ac0c62"
      },
      "owner": {
        "id": 1,
        "gammaId": "2f63a363-af22-480d-be49-531c1831933c",
        "firstName": "Jane",
        "lastName": "Doe",
        "nick": "Dough",
        "avatarUrl": "https://auth.chalmers.it/images/user/avatar/2f63a363-af22-480d-be49-531c1831933c"
      },
      "displayName": "P.R.I.T. Scanner",
      "description": "Beep beep!!"
    }
  }
}
```

#### Errors

| Code | Error                      |
| ---- | -------------------------- |
| 403  | Display name is not unique |

### GET /group/client/\<id\>

Get details about a group client.

#### Response

```javascript
{
  "data": {
    "client": GroupClient
  }
}
```

##### Example

```javascript
{
  "data": {
    "client": {
      "id": "01KP4C3XYVZNCQRAQ8D9MX21QK",
      "scope": "items.read transactions.write",
      "group": {
        "id": 1,
        "gammaId": "3cf94646-2412-4896-bba9-5d2410ac0c62",
        "prettyName": "P.R.I.T. 25",
        "avatarUrl": "https://auth.chalmers.it/images/group/avatar/3cf94646-2412-4896-bba9-5d2410ac0c62"
      },
      "owner": {
        "id": 1,
        "gammaId": "2f63a363-af22-480d-be49-531c1831933c",
        "firstName": "Jane",
        "lastName": "Doe",
        "nick": "Dough",
        "avatarUrl": "https://auth.chalmers.it/images/user/avatar/2f63a363-af22-480d-be49-531c1831933c"
      },
      "displayName": "P.R.I.T. Scanner",
      "description": "Beep beep!!"
    }
  }
}
```

#### Errors

| Code | Error                 |
| ---- | --------------------- |
| 404  | Client does not exist |

### DELETE /group/client/\<id\>

Delete a group client.

#### Errors

| Code | Error                 |
| ---- | --------------------- |
| 404  | Client does not exist |
