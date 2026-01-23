/**
 * Email Template Service
 * Generates professional email templates for job application follow-ups
 * Key competitive differentiator - automates next steps
 */

export interface EmailTemplate {
	subject: string;
	body: string;
	timing: string;
	tips: string[];
}

export interface TemplateContext {
	candidateName: string;
	jobTitle: string;
	companyName: string;
	recruiterName?: string;
	applicationDate?: Date;
	interviewDate?: Date;
	interviewerName?: string;
	customNote?: string;
}

export type EmailTemplateType =
	| 'follow-up-application'
	| 'follow-up-interview'
	| 'thank-you-interview'
	| 'thank-you-phone-screen'
	| 'withdraw-application'
	| 'accept-offer'
	| 'decline-offer'
	| 'request-update'
	| 'networking-introduction'
	| 'referral-request';

/**
 * Generate an email template based on type and context
 */
export function generateEmailTemplate(
	type: EmailTemplateType,
	context: TemplateContext
): EmailTemplate {
	const { candidateName, jobTitle, companyName, recruiterName, applicationDate, interviewDate, interviewerName } = context;
	const firstName = candidateName.split(' ')[0];
	const greeting = recruiterName ? `Dear ${recruiterName}` : 'Dear Hiring Team';
	const daysAgo = applicationDate ? Math.floor((Date.now() - applicationDate.getTime()) / (1000 * 60 * 60 * 24)) : 7;

	switch (type) {
		case 'follow-up-application':
			return {
				subject: `Following Up: ${jobTitle} Application - ${candidateName}`,
				body: `${greeting},

I hope this message finds you well. I wanted to follow up on my application for the ${jobTitle} position at ${companyName}, which I submitted ${daysAgo > 1 ? `${daysAgo} days` : 'recently'} ago.

I remain very interested in this opportunity and believe my background would allow me to make meaningful contributions to your team. I would welcome the chance to discuss how my experience aligns with your needs.

Please let me know if you need any additional information from me. I look forward to hearing from you.

Best regards,
${candidateName}`,
				timing: 'Send 7-10 business days after submitting your application',
				tips: [
					'Keep it brief - hiring managers are busy',
					'Reaffirm your interest without being pushy',
					'Offer to provide additional information',
					'Only follow up once unless they respond'
				]
			};

		case 'thank-you-interview':
			return {
				subject: `Thank You - ${jobTitle} Interview`,
				body: `${interviewerName ? `Dear ${interviewerName}` : greeting},

Thank you for taking the time to meet with me ${interviewDate ? 'today' : 'recently'} to discuss the ${jobTitle} position at ${companyName}.

I enjoyed learning more about the role and the team's work. Our conversation reinforced my enthusiasm for this opportunity, particularly [mention something specific discussed in the interview].

I'm confident that my experience in [relevant skill/experience] would enable me to contribute effectively to your team. Please don't hesitate to reach out if you need any additional information.

Thank you again for your consideration. I look forward to the next steps.

Best regards,
${candidateName}`,
				timing: 'Send within 24 hours of your interview',
				tips: [
					'Reference something specific from the conversation',
					'Keep it under 200 words',
					'Proofread carefully - typos here hurt more',
					'Send to each interviewer individually with personalized notes',
					'Replace [brackets] with specific details from your interview'
				]
			};

		case 'thank-you-phone-screen':
			return {
				subject: `Thank You for the Phone Screen - ${jobTitle}`,
				body: `${recruiterName ? `Dear ${recruiterName}` : greeting},

Thank you for speaking with me ${interviewDate ? 'today' : 'earlier'} about the ${jobTitle} position at ${companyName}.

I appreciated learning more about the role and the team. Based on our conversation, I'm even more excited about the possibility of contributing to ${companyName}.

I look forward to the opportunity to continue the interview process and learn more about how I can add value to your team.

Best regards,
${candidateName}`,
				timing: 'Send within 24 hours of the phone screen',
				tips: [
					'Keep it shorter than an in-person interview thank you',
					'Confirm your continued interest',
					'Mention something specific from the call if possible'
				]
			};

		case 'follow-up-interview':
			return {
				subject: `Following Up: ${jobTitle} Interview`,
				body: `${greeting},

I hope you're doing well. I wanted to follow up regarding my interview for the ${jobTitle} position ${interviewDate ? `on ${interviewDate.toLocaleDateString()}` : 'last week'}.

I remain enthusiastic about the opportunity to join ${companyName} and contribute to the team. If there's any additional information I can provide to support the decision-making process, please let me know.

I understand hiring decisions take time and appreciate your consideration.

Best regards,
${candidateName}`,
				timing: 'Send 5-7 business days after the interview if you haven\'t heard back',
				tips: [
					'Only send if you haven\'t received a timeline update',
					'Be patient but proactive',
					'Keep the tone positive and professional',
					'Don\'t sound desperate or impatient'
				]
			};

		case 'withdraw-application':
			return {
				subject: `Withdrawal of Application - ${jobTitle}`,
				body: `${greeting},

Thank you for considering my application for the ${jobTitle} position at ${companyName}.

After careful consideration, I have decided to withdraw my application at this time. This was not an easy decision, as I have great respect for ${companyName} and the opportunity.

I appreciate the time you and your team have invested in my candidacy and hope our paths may cross again in the future.

Thank you for your understanding.

Best regards,
${candidateName}`,
				timing: 'Send as soon as you\'ve made your decision',
				tips: [
					'Keep it brief and professional',
					'You don\'t need to explain your reasons in detail',
					'Leave the door open for future opportunities',
					'Don\'t burn bridges - the industry is small'
				]
			};

		case 'accept-offer':
			return {
				subject: `Offer Acceptance - ${jobTitle}`,
				body: `${greeting},

I am thrilled to formally accept the offer for the ${jobTitle} position at ${companyName}.

Thank you for this opportunity. I am excited to join the team and contribute to ${companyName}'s success. I am prepared to begin on [start date] as discussed.

Please let me know if there are any documents or information you need from me before my start date.

I look forward to working with you and the team.

Best regards,
${candidateName}`,
				timing: 'Send within 24-48 hours of receiving the offer',
				tips: [
					'Confirm the start date and any negotiated terms',
					'Express genuine enthusiasm',
					'Ask about next steps and onboarding',
					'Keep a copy for your records'
				]
			};

		case 'decline-offer':
			return {
				subject: `Re: ${jobTitle} Offer`,
				body: `${greeting},

Thank you so much for offering me the ${jobTitle} position at ${companyName}. I truly appreciate the time and consideration you and your team have given me throughout this process.

After careful thought, I have decided to decline the offer. This was a difficult decision, as I was impressed by ${companyName} and the team.

I hope we can stay in touch, and I wish you and the team continued success.

Thank you again for this opportunity.

Best regards,
${candidateName}`,
				timing: 'Respond as soon as you\'ve made your decision - don\'t leave them waiting',
				tips: [
					'Be gracious and professional',
					'You don\'t have to explain your reasons',
					'Don\'t burn bridges - you might want to work there later',
					'Keep it brief'
				]
			};

		case 'request-update':
			return {
				subject: `Status Update Request - ${jobTitle} Position`,
				body: `${greeting},

I hope this message finds you well. I wanted to reach out to inquire about the status of my application for the ${jobTitle} position.

I remain very interested in joining ${companyName} and would appreciate any update you can share about the timeline or next steps.

Thank you for your time and consideration.

Best regards,
${candidateName}`,
				timing: 'Send after the expected timeline has passed',
				tips: [
					'Reference any timeline they previously mentioned',
					'Be polite and understanding',
					'Keep it very brief',
					'Only send once unless they respond'
				]
			};

		case 'networking-introduction':
			return {
				subject: `Introduction - ${firstName} (Interest in ${companyName})`,
				body: `${recruiterName ? `Dear ${recruiterName}` : 'Hello'},

I hope this message finds you well. My name is ${candidateName}, and I'm reaching out because I'm interested in opportunities at ${companyName}, specifically in ${jobTitle.toLowerCase()} roles.

I have [X years] of experience in [your field], and I've been following ${companyName}'s work in [specific area]. I'm impressed by [specific thing about the company].

I would greatly appreciate the opportunity to learn more about the team and any potential opportunities. Would you have 15-20 minutes for a brief conversation?

Thank you for your time.

Best regards,
${candidateName}`,
				timing: 'Send during business hours, Tuesday-Thursday typically best',
				tips: [
					'Personalize each message - no mass emails',
					'Research the person before reaching out',
					'Be specific about why you\'re interested',
					'Make it easy for them to say yes to a brief call',
					'Replace [brackets] with your actual information'
				]
			};

		case 'referral-request':
			return {
				subject: `Quick Question About ${companyName}`,
				body: `Hi [Contact Name],

I hope you're doing well! I noticed you work at ${companyName}, and I wanted to reach out because I'm interested in the ${jobTitle} position they have open.

I've been working in [your field] for [X years] and am particularly drawn to ${companyName} because of [specific reason].

Would you be willing to share any insights about the team or the role? If you think I might be a good fit, I would be grateful for a referral, but no pressure at all - I completely understand if that's not possible.

Either way, I'd love to catch up if you have time.

Thanks so much!
${firstName}`,
				timing: 'Send after you\'ve applied to the position',
				tips: [
					'Only ask people you have a genuine connection with',
					'Make it easy for them to say no',
					'Attach your resume if they agree to refer',
					'Thank them regardless of outcome',
					'Replace [brackets] with specific information'
				]
			};

		default:
			return {
				subject: `Re: ${jobTitle} at ${companyName}`,
				body: `${greeting},

I wanted to reach out regarding the ${jobTitle} position at ${companyName}.

${context.customNote || 'Please let me know if you need any additional information from me.'}

Best regards,
${candidateName}`,
				timing: 'Depends on context',
				tips: ['Customize based on your specific situation']
			};
	}
}

/**
 * Get all available template types with descriptions
 */
export function getTemplateTypes(): Array<{ type: EmailTemplateType; label: string; description: string }> {
	return [
		{
			type: 'follow-up-application',
			label: 'Application Follow-up',
			description: 'Follow up on a submitted application'
		},
		{
			type: 'thank-you-interview',
			label: 'Interview Thank You',
			description: 'Thank you note after an interview'
		},
		{
			type: 'thank-you-phone-screen',
			label: 'Phone Screen Thank You',
			description: 'Thank you note after a phone screen'
		},
		{
			type: 'follow-up-interview',
			label: 'Interview Follow-up',
			description: 'Follow up after an interview'
		},
		{
			type: 'request-update',
			label: 'Request Status Update',
			description: 'Ask for an update on your application'
		},
		{
			type: 'accept-offer',
			label: 'Accept Offer',
			description: 'Formally accept a job offer'
		},
		{
			type: 'decline-offer',
			label: 'Decline Offer',
			description: 'Politely decline a job offer'
		},
		{
			type: 'withdraw-application',
			label: 'Withdraw Application',
			description: 'Withdraw from the hiring process'
		},
		{
			type: 'networking-introduction',
			label: 'Networking Introduction',
			description: 'Introduce yourself to someone at a company'
		},
		{
			type: 'referral-request',
			label: 'Referral Request',
			description: 'Ask a contact for a referral'
		}
	];
}

/**
 * Format date for display in templates
 */
export function formatDateForTemplate(date: Date): string {
	return date.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

/**
 * Calculate suggested follow-up date based on application date
 */
export function getSuggestedFollowUpDate(applicationDate: Date): Date {
	const followUpDate = new Date(applicationDate);
	followUpDate.setDate(followUpDate.getDate() + 7); // 7 business days

	// Skip weekends
	const day = followUpDate.getDay();
	if (day === 0) followUpDate.setDate(followUpDate.getDate() + 1);
	if (day === 6) followUpDate.setDate(followUpDate.getDate() + 2);

	return followUpDate;
}
