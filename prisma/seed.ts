import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

console.log("Adding example data")

async function main() {
    // Group 1
    console.log("Creating group 1")
    const group1 = await prisma.group.create({
        data: {
            gammaId: '3cf94646-2412-4896-bba9-5d2410ac0c62', // P.R.I.T. 25
            users: {
                create: [
                    {
                        user: {
                            create: {
                                gammaId: '7ba99a26-9ad3-4ad8-ab7f-5891c2d82a4b',
                            },
                        },
                    }, // Cal
                    {
                        user: {
                            create: {
                                gammaId: 'b69e01cd-01d1-465e-adc5-99d017b7fd74',
                            },
                        },
                    }, // Göken
                ],
            },
            items: {
                create: [
                    {
                        displayName: 'Fanta',
                        prices: {
                            create: [{ displayName: 'P.R.I.T.', price: 7 }],
                        },
                    },
                    {
                        displayName: 'Coca-Cola',
                        iconUrl:
                            'https://product-cdn.systembolaget.se/productimages/507795/507795_400.png',
                        prices: {
                            create: [
                                { displayName: 'P.R.I.T.', price: 10 },
                                { displayName: 'Pateter', price: 12 },
                                { displayName: 'Extern', price: 15 },
                            ],
                        },
                    },
                ],
            },
        },
    })

    const fanta = await prisma.item.findUnique({
        where: {
            groupId_displayName: { displayName: 'Fanta', groupId: group1.id },
        },
    })
    const cocaCola = await prisma.item.findUnique({
        where: {
            groupId_displayName: {
                displayName: 'Coca-Cola',
                groupId: group1.id,
            },
        },
    })

    const cal = await prisma.user.findUnique({
        where: { gammaId: '7ba99a26-9ad3-4ad8-ab7f-5891c2d82a4b' },
    })
    const goken = await prisma.user.findUnique({
        where: { gammaId: 'b69e01cd-01d1-465e-adc5-99d017b7fd74' },
    })

    // Group 1 Transactions
    console.log("Creating group 1 transactions")
    await prisma.transaction.create({
        data: {
            groupId: group1.id,
            type: 'PURCHASE',
            createdById: goken!.id,
            purchase: {
                create: {
                    createdForId: goken!.id,
                    items: {
                        create: [
                            {
                                itemId: fanta!.id,
                                displayName: 'Fanta Orange',
                                purchasePrice: 7,
                                purchasePriceName: 'P.R.I.T.',
                                quantity: 2,
                            },
                        ],
                    },
                },
            },
        },
    })

    await prisma.transaction.create({
        data: {
            groupId: group1.id,
            type: 'PURCHASE',
            createdById: goken!.id,
            purchase: {
                create: {
                    createdForId: cal!.id,
                    items: {
                        create: [
                            {
                                itemId: cocaCola!.id,
                                displayName: 'Coca-Cola',
                                purchasePrice: 10,
                                purchasePriceName: 'P.R.I.T.',
                                quantity: 3,
                            },
                            {
                                itemId: fanta!.id,
                                displayName: 'Fanta Orange',
                                purchasePrice: 7,
                                purchasePriceName: 'P.R.I.T.',
                                quantity: 1,
                            },
                        ],
                    },
                },
            },
        },
    })

    await prisma.transaction.create({
        data: {
            groupId: group1.id,
            type: 'DEPOSIT',
            createdById: goken!.id,
            deposit: {
                create: {
                    createdForId: goken!.id,
                    total: 250,
                },
            },
        },
    })

    await prisma.favoriteItem.create({
        data: { userId: goken!.id, itemId: fanta!.id },
    })

    // Group 2
    console.log("Creating group 2")
    const group2 = await prisma.group.create({
        data: {
            gammaId: '8b2ac9fc-22c3-40f8-aa33-89b02d1a260b', // P.R.I.T. 24
            users: {
                create: [
                    {
                        user: {
                            create: {
                                gammaId: '614f7934-3d2e-4452-a4cd-6afca93b66d7',
                            },
                        },
                    }, // Frögg
                    {
                        user: {
                            create: {
                                gammaId: 'ec202592-50b2-471c-96c6-893493cf724e',
                            },
                        },
                    }, // Fredag
                ],
            },
            items: {
                create: [
                    {
                        displayName: "Fredag's läskiga dryck",
                        prices: {
                            create: [
                                { displayName: 'De som vågar', price: 16 },
                            ],
                        },
                    },
                ],
            },
        },
    })

    const fredagDrink = await prisma.item.findUnique({
        where: {
            groupId_displayName: {
                displayName: "Fredag's läskiga dryck",
                groupId: group2.id,
            },
        },
    })
    const frogg = await prisma.user.findUnique({
        where: { gammaId: '614f7934-3d2e-4452-a4cd-6afca93b66d7' },
    })
    const fredag = await prisma.user.findUnique({
        where: { gammaId: 'ec202592-50b2-471c-96c6-893493cf724e' },
    })

    // Group 2 Transactions
    console.log("Creating group 2 transactions")
    await prisma.transaction.create({
        data: {
            groupId: group2.id,
            type: 'PURCHASE',
            createdById: frogg!.id,
            purchase: {
                create: {
                    createdForId: fredag!.id,
                    items: {
                        create: [
                            {
                                itemId: fredagDrink!.id,
                                displayName: "Fredag's läskiga dryck",
                                purchasePrice: 16,
                                purchasePriceName: 'De som vågar',
                                quantity: 1,
                            },
                        ],
                    },
                },
            },
        },
    })

    await prisma.transaction.create({
        data: {
            groupId: group2.id,
            type: 'STOCK_UPDATE',
            createdById: fredag!.id,
            stockUpdate: {
                create: {
                    items: {
                        create: [
                            { itemId: fredagDrink!.id, before: 0, after: 5 },
                        ],
                    },
                },
            },
        },
    })

    await prisma.transaction.create({
        data: {
            groupId: group2.id,
            type: 'STOCK_UPDATE',
            createdById: frogg!.id,
            comment: 'Fredag gjorde mer dryck',
            stockUpdate: {
                create: {
                    items: {
                        create: [
                            { itemId: fredagDrink!.id, before: 5, after: 10 },
                        ],
                    },
                },
            },
        },
    })

    await prisma.transaction.create({
        data: {
            groupId: group2.id,
            type: 'PURCHASE',
            createdById: frogg!.id,
            purchase: {
                create: {
                    createdForId: frogg!.id,
                    items: {
                        create: {
                            itemId: fredagDrink!.id,
                            displayName: "Fredag's läskiga dryck",
                            purchasePrice: 16,
                            purchasePriceName: 'De som vågar',
                            quantity: 2,
                        },
                    },
                },
            },
        },
    })
}

main().finally(async () => await prisma.$disconnect())
