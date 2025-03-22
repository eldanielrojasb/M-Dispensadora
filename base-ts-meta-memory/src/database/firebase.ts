import { MemoryDB } from '@builderbot/bot'
import firebase, { database } from "firebase-admin"
import { Database } from 'firebase-admin/lib/database/database'
import type { FirebaseAdapterCredentials } from './types'


class FirebaseAdapter extends MemoryDB {
    db: Database
    private table = 'history'
    private ordersTable = "ordenes";
    listHistory = []

    /**
     * Constructs a new FirebaseAdapter instance.
     * @param {FirebaseAdapterCredentials} credentials
     */
    constructor(private credentials: FirebaseAdapterCredentials) {
        super()
        this.init().then().catch((e) => {throw new Error(e?.message)})
    }

    /**
     * Initializes the Firebase connection and checks for the existence of the specified table.
     * @returns {Promise<void>} - A Promise that resolves when the initialization is complete.
     */
    async init(): Promise<void> {
        const certModule = await import(this.credentials.pathPrivateKeyJson)
        const cert = certModule.default
        firebase.initializeApp({
            credential: firebase.credential.cert(cert),
            databaseURL: this.credentials.databaseURL
          
        });
        
        
        this.db = firebase.database()        
    }

    /* 
    * SECCION DE GESTION DE ORDENES
    */
    /**
     * Creates a new order with pending status.
     * @param {string} userId - The ID of the user placing the order (name or phonenumber).
     * @param {string} productId - The product identifier (e.g., P001, P002).
     * @param {number} value - The total order value.
     */
    async createOrder(userId: string, productId: string, value: number) {
        const order = {
            userId,
            productId,
            value,
            status: "pendiente",
            createdAt: new Date().toISOString()
        };
        const a = await this.db.ref(`${this.ordersTable}`).push(order);
        const e =a.key
        return e


    }

    /**
     * Updates the order status.
     * @param {string} orderId - The order ID in the database.
     * @param {"aprobada" | "rechazada"} status - The new status of the order.
     */
        async updateOrderStatus(orderId: string, status: "aprobada" | "rechazada") {
            await this.db.ref(`${this.ordersTable}/${orderId}`).update({ status });
            /*this.notifyUser(orderId, status);*/
        }

}

export { FirebaseAdapter }
