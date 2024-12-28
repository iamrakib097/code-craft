import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix"; // Correct import for Webhook verification
import type { WebhookEvent } from "@clerk/nextjs/server"; // Correct type import for WebhookEvent
import {api} from "./_generated/api"
const http = httpRouter();

http.route({
  path: "/clerk-webhook", // Corrected typo in "cleck" to "clerk"
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET; // Fixed environment variable name typo
    if (!webhookSecret) {
      throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("Missing required Svix headers");
      return new Response("Missing Svix headers", { status: 400 });
    }

    const payload = await req.text(); 

    const webhook = new Webhook(webhookSecret);

    let event: WebhookEvent;
    try {
      event = webhook.verify(payload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as WebhookEvent; 
    } catch (error) {
      console.error("Invalid webhook signature", error);
      return new Response("Invalid webhook signature", { status: 400 });
    }

    const eventType = event.type;

    if (eventType === "user.created") {
        //save the user to convex db
        const {id,email_addresses,first_name,last_name}=event.data;   
        const email=email_addresses[0].email_address;
        const name=`${first_name || ""} ${last_name || ""}`.trim();
        
        try{
            //save user to db
            await ctx.runMutation(api.users.syncUser,{
              userId:id,
              email,
              name,
            })
        }catch(e){
          console.log("Error creating user:", e)
            return new Response("Error creating user",{status:500})
        }
    }
    return new Response("Webhook processed successfully",{status:200})
  }),
});

export default http;
