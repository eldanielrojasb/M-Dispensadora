import { dirname, join } from 'path'
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv'
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import { delay } from '@builderbot/bot/dist/utils'
import { FirebaseAdapter } from './database/firebase'
import { readFileSync } from 'fs';

dotenv.config()

const PORT = process.env.PORT ?? 3008

//Productos que se pueden escoger...
class Producto {
    constructor(public id: string, public nombre: string, public valor: number) {}

    private static productos: Record<string, Producto> = Producto.cargarProductos();

    private static cargarProductos(): Record<string, Producto> {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const rutaArchivo = join(__dirname, '../archivos/menu.txt');
        const productos: Record<string, Producto> = {};
        
        try {
            const data = readFileSync(rutaArchivo, 'utf8');
            const lineas = data.split('\n');

            for (const linea of lineas) {
                const [id, nombre, valor] = linea.split(',');
                if (id && nombre && valor) {
                    productos[id.trim()] = new Producto(id.trim(), nombre.trim(), parseInt(valor.trim(), 10));
                }
            }
        } catch (error) {
            console.error("Error al leer el archivo de productos:", error);
        }

        return productos;
    }

    static obtenerProducto(codigo: string): Producto | null {
        return this.productos[codigo] || null;
    }
}

//Flujo de bienvenida ofreciendo los productos
const welcomeFlow = addKeyword(EVENTS.WELCOME)
    //Primer mensaje con botones
    .addAnswer("🤖 ¡Hola! Bienvenido a _ElDanissito Cakes_ \n\nSelecciona un producto o *digita su ID* para continuar:", {
        buttons: [
            { body: `P001` },
            { body: `P002` },
            { body: `P003` },
        ]
    })
    .addAnswer("Para ver más opciones presiona aquí", {
        buttons: [
            {body: "Más"}]
    })
    //Accion encargada de capturar el siguiente mensaje. (Se espera que sea el producto)
    .addAction( { capture: true }, async (ctx, ctxFn) => {
        const orden = ctx.body
        const producto = Producto.obtenerProducto(orden)

        if (producto) {
            await ctxFn.state.update({ productoSeleccionado: producto })
            await ctxFn.flowDynamic(`🛒 *Producto seleccionado* \n🔹 *${producto.nombre}* \n💰Precio: $${producto.valor}.`)
            return ctxFn.gotoFlow(confirmationFlow)
        }else if(orden === "Más"){
            return ctxFn.gotoFlow(masOpcionesFlow)
        }else {
            await ctxFn.flowDynamic("👉 Por favor, selecciona una opción válida del menú.")
            return ctxFn.gotoFlow(welcomeFlow)
        }
    })

const masOpcionesFlow = addKeyword(EVENTS.ACTION)
    .addAnswer("Menú 2", {
        buttons: [
            { body: "P004" },
            { body: "P005" },
            { body: "P006" },
        ]
    })
    .addAnswer("Para volver al menú 1 presiona aquí", {
        buttons: [
            {body: "volver"}]
    })
    .addAction( { capture: true }, async (ctx, ctxFn) => {
        const orden = ctx.body
        const producto = Producto.obtenerProducto(orden)
        if (producto) {
            await ctxFn.state.update({ productoSeleccionado: producto })
            await ctxFn.flowDynamic(`Has seleccionado ${producto.nombre}. Su precio es $${producto.valor}.`)
            return ctxFn.gotoFlow(confirmationFlow)
        }else if(orden === "volver"){
            return ctxFn.gotoFlow(welcomeFlow)
        }else {
            await ctxFn.flowDynamic("👉 Por favor, selecciona una opción válida del menú.")
            return ctxFn.gotoFlow(masOpcionesFlow)
        }
    })



//Flujo de confirmación para el usuario
const confirmationFlow = addKeyword(EVENTS.ACTION)
    //Opciones para que el usuario confirme
    .addAnswer(`📦 Confirma tu pedido:`, {buttons:[
        {body: "🔘 Confirmar"},
        {body: "❌ Cancelar"}
    ]})
    //Accion para capturar la respuesta del usuario
    .addAction({ capture: true }, async (ctx, { state }) => {
        await state.update({ decision: ctx.body })
    })
    //Acción para decidir el flujo segun la decision del usuario
    .addAction(async (_, { flowDynamic, state, gotoFlow }) => {
        const decision = state.get('decision')
        if (decision === "🔘 Confirmar") {
            return gotoFlow(pagoFlow) //Confirma el pedido se dirige a pagoFlow
        } else if(decision === "❌ Cancelar"){
            await flowDynamic(`🛑 Tu pedido ha sido cancelado. \n✏️ Escribe cualquier cosa para volver a empezar.`)
        }else{
            await flowDynamic("⚠️ _Ingresa una opción válida para continuar_")
            return gotoFlow(confirmationFlow)
        }
    })

//Flow de pago, se ejecuta solo cuando el usuario confirma su pedido
const pagoFlow = addKeyword(EVENTS.ACTION)
    //Accion para enviar a la base de datos la orden y avisar al usuario sobre las formas de pago
    .addAction(async (_, { state, flowDynamic, gotoFlow, }) => {
        const producto: Producto = state.get('productoSeleccionado')
        if (producto) {
            globalThis.ID = createUserOrder(globalThis.adapterDB,_.from, producto.nombre, producto.valor)
            await flowDynamic(`💰 Para completar tu compra, envía $${producto.valor} usando:\n✅Nequi\n✅Transfiyá\n✅Bre-B/Llaves\n📲Número: *3028659218*.`)
            await flowDynamic('🔍 *Facilita tu pago con un QR*. Solo escribe "QR" y te lo generamos al momento.', {delay:2000})
            console.log("Esperando confirmacion del admin")
            return gotoFlow(userConfirmationFlow) //Se envía al userConfirmationFlow
        } else {
            await flowDynamic("❌ Hubo un error al obtener el producto. 🔄 Por favor, intenta nuevamente.")
            return gotoFlow(welcomeFlow)
        }
    })

//Flujo de confirmacion al usuario
const adminPhoneNumber = process.env.adminPhoneNumber; // Reemplázalo con el número real del administrador

const userConfirmationFlow = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, state, gotoFlow }) => {
        const producto: Producto = state.get('productoSeleccionado');
        globalThis.userId = ctx.from;
        const ID = await globalThis.userId 

        if (producto) {
            await flowDynamic("📢Estamos confirmando el pago...");
            // Mensaje al administrador
            await globalThis.adapterProvider.sendMessage(adminPhoneNumber, `📦 Nueva orden pendiente:
            \n👤 Cliente: ${ID} - ${ctx.name}
            \n🛍️ Producto: ${producto.nombre}
            \n💰 Precio: $${producto.valor}`,
             {buttons:[
                {body: "✅ Aprobar"},
                {body: "❌ Rechazar"}
            ]})
            
            return gotoFlow(adminResponseFlow);
        } else {
            await flowDynamic("❌ Hubo un error al obtener el producto. 🔄 Intenta nuevamente.");
            return gotoFlow(welcomeFlow);
        }
    });

//Contexto de admin
const adminResponseFlow = addKeyword(EVENTS.ACTION)
    .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
        const userId = await globalThis.userId;
        const decision = ctx.body
        const orderId = await globalThis.ID
        console.log(orderId)
        if (decision === "✅ Aprobar") {
            await globalThis.adapterDB.updateOrderStatus(orderId, "aprobada");
            console.log(userId)
            await globalThis.adapterProvider.sendMessage(userId, "✅ Pago recibido con éxito.\nLa máquina dispensadora procesará tu pedido en breve. 🚀",{media:null});
            await flowDynamic("👍 Has aprobado el pedido.");
        } else if (decision === "❌ Rechazar") {
            await globalThis.adapterDB.updateOrderStatus(orderId, "rechazada");
            await globalThis.adapterProvider.sendMessage(userId, "❌ Lo sentimos, tu pedido ha sido rechazado.", {media:null});
            await flowDynamic("👎 Has rechazado el pedido.");
        } else {
            await flowDynamic("⚠️ Ingresa una opción válida (Aprobar/Rechazar).");
            return ctx.gotoFlow(adminResponseFlow);
        }
    });



const createUserOrder = async (db: FirebaseAdapter, userId: string, productId: string, price: number) => {
    try {
        // Crear la orden con estado "pendiente"
        const orderid = await globalThis.adapterDB.createOrder(userId, productId, price);
        console.log("Orden creada con éxito.")
        return(orderid)

    } catch (error) {
        console.error("Error al crear la orden:", error)
    }
}

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, confirmationFlow, pagoFlow, userConfirmationFlow, adminResponseFlow, masOpcionesFlow])
    globalThis.adapterProvider = createProvider(Provider, {
        jwtToken: process.env.jwtToken,
        numberId: process.env.numberId,
        verifyToken: process.env.verifyToken,
        version: process.env.version
    })
    
    globalThis.adapterDB = new FirebaseAdapter({
        databaseURL: process.env.databaseURL,
        pathPrivateKeyJson: process.env.pathPrivateKeyJson
    })

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: globalThis.adapterProvider,
        database: globalThis.adapterDB,
    })

    globalThis.adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    httpServer(+PORT)
}

main()
