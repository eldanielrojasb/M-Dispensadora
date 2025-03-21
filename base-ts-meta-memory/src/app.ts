import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { MetaProvider as Provider } from '@builderbot/provider-meta'

const PORT = process.env.PORT ?? 3008

const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAnswer("🤖 ¡Hola! Bienvenido a Tortas By _ElDanissito_ \n\nSelecciona un producto para continuar:",
    {buttons:[
        {body: "P001"},
        {body: "P002"},
        {body: "P003"}
    ]})
    .addAnswer("Esperando respuesta",
        {capture: true},
        async (ctx,ctxFn) =>{
            const orden = await ctx.body
            if(orden === "P001"|| orden === "P002" || orden === "P003"){
                ctxFn.endFlow
                ctxFn.flowDynamic(`Tu pedido es ${(orden)}`)
                ctxFn.gotoFlow(registerFlow)
            }else{
                ctxFn.fallBack("Por favor selecciona una opción válida")
                ctxFn.gotoFlow(welcomeFlow)
            }
        }
    )

const registerFlow = addKeyword<Provider, Database>(utils.setEvent('REGISTER_FLOW'))
    .addAnswer(`Confirma el pedido`, {buttons:[
        {body: "Confirmar"},
        {body: "Cancelar"}
    ]})
    .addAnswer('', { capture: true }, async (ctx, { state }) => {
        await state.update({ decision: ctx.body })
    })
    .addAction(async (_, { flowDynamic, state, fallBack, gotoFlow }) => {
        if (state.get('decision') === "Confirmar"){
            flowDynamic(`Tu pedido ha sido confirmado`)
            gotoFlow(pagoflow)
        }else if((state.get('decision') === "Cancelar")){
            flowDynamic(`Tu pedido ha sido cancelado`)
        }else{
            fallBack("Por favor seleccione una opción")
            gotoFlow(registerFlow)
        }
    })

const pagoflow = addKeyword(EVENTS.ACTION)
.addAnswer("Realiza tu pago por nequi este número")



const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, registerFlow])
    const adapterProvider = createProvider(Provider, {
        jwtToken: 'EAAI1dzYZBE3MBOxnLDsLSmltPg87ZC3Hal3ZAj454Eer3WuvZBn0nLG4iHFB1MVk89fBEXXlLC5ZAYQZBzS8UnwuskciBaWsWEoezZAEVRmYLNxEDYOZCiyQSMaXZA2mMgqqgQopzyE3zggI7EAZBRmn5VOPKMTfRo6wQf3Wl9qTQWjWmjZAqTlpycXWFwmV4AVYxaQngZDZD',
        numberId: '611626308698306',
        verifyToken: 'pepino',
        version: 'v22.0'
    })
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
