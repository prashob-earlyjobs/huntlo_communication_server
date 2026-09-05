import { MessageVendor, SendMessageBody } from "../types/message.types";
import { sendGmailMessage } from "./gmail.service";
import { makeHunarCall, makeZyvkayCall } from "./hunar.service";
import { sendSmtpMessage } from "./smtp.service";
import { sendWhatsappMessageHuntlo, sendWhatsappMessageTextHuntlo } from "./whatsapp.service";



export const sendWhatsappMessage = async(messageBody: SendMessageBody) => {



    if(messageBody.vendor === MessageVendor.HUNTLO){
        if (messageBody.template) {
          return sendWhatsappMessageHuntlo({
              to:messageBody.to,
              template:messageBody.template ?? null,
              body:messageBody.body ?? null,
              variables: messageBody.variables
          })
        }

        return sendWhatsappMessageTextHuntlo({
          to: messageBody.to,
          body: messageBody.body ?? "",
        })
    }
};




export const sendCall = async(messageBody: any) =>{
  console.log(messageBody)
  if (messageBody.vendor === MessageVendor.HUNAR) {
    return makeHunarCall({
      agentId: messageBody.agent_id,
      data: messageBody.data,
      campignId: messageBody.campaign_id || messageBody.campignId,
    });
  } else if (messageBody.vendor === MessageVendor.ZYVKAY) {
    return makeZyvkayCall({
      campaignId: messageBody.campaign_id || messageBody.campaignId,
      prompt: messageBody.prompt,
      data: messageBody.data,
      metadata: messageBody.metadata,
      questions: messageBody.questions,
    });
  }
}




export const sendEmailMessage = async (messageBody: SendMessageBody) => {
  if (messageBody.vendor === MessageVendor.GMAIL) {
    
    return sendGmailMessage({
      accessToken: messageBody.accessToken,
      to: messageBody.to,
      subject: messageBody.subject ?? "",
      text: messageBody.body,
      html: messageBody.html,
      from: messageBody.from ?? null,
      threadId: messageBody.threadId ?? null,
      inReplyTo: messageBody.inReplyTo ?? null,
      references: messageBody.references ?? null,
    });
  }

  if (messageBody.vendor === MessageVendor.SMTP) {
    return sendSmtpMessage({
      to: messageBody.to,
      subject: messageBody.subject,
      body: messageBody.body,
      html: messageBody.html,
      smtp: messageBody.smtp,
    });
  }
  
  if (messageBody.vendor === MessageVendor.OUTLOOK) {
    console.log("outlook needs to be configured");
    return;
  }


};