export class EmailService {
  async sendPartnerOtp(
    partnerEmail: string,
    userName: string,
    action: string,
    otpCode: string
  ): Promise<void> {
    const formattedAction = action.replace(/_/g, ' ').toLowerCase();

    // In local development or until an external SMTP/Resend key is supplied,
    // we log the OTP clearly to stdout so developers can test the full flow immediately.
    console.log('\n======================================================');
    console.log(`📨 [ZEROFEED EMAIL SERVICE] DISPATCHING PARTNER OTP`);
    console.log(`To: ${partnerEmail}`);
    console.log(`Subject: Verification Code from ${userName || 'Your Partner'}`);
    console.log(`Action Requested: ${formattedAction}`);
    console.log(`🔐 6-DIGIT VERIFICATION CODE: [ ${otpCode} ]`);
    console.log(`Expires in: 15 minutes`);
    console.log('======================================================\n');
  }
}

export const emailService = new EmailService();
