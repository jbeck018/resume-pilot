// Email templates for Resume Pilot
// All templates are responsive HTML with inline styles for email client compatibility

export interface EmailTemplateData {
	preheader?: string;
	title: string;
	content: string;
	ctaText?: string;
	ctaUrl?: string;
	footer?: string;
}

// Base email layout wrapper
export function baseTemplate(data: EmailTemplateData): string {
	const { preheader = '', title, content, ctaText, ctaUrl, footer } = data;

	return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px 16px !important; }
      .job-card { padding: 16px !important; }
      .header-logo { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; line-height: 1.6;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table class="container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
              <h1 class="header-logo" style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                Resume Pilot
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content" style="padding: 40px 32px;">
              ${content}

              ${ctaText && ctaUrl ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 8px;">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              ${footer || ''}
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #9ca3af;">
                Resume Pilot - AI-Powered Job Search
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

// Welcome email template
export interface WelcomeEmailData {
	userName: string;
	dashboardUrl: string;
	unsubscribeUrl: string;
}

export function welcomeEmail(data: WelcomeEmailData): string {
	const { userName, dashboardUrl, unsubscribeUrl } = data;

	return baseTemplate({
		preheader: 'Welcome to Resume Pilot! Your AI-powered job search starts now.',
		title: 'Welcome to Resume Pilot',
		content: `
      <h2 style="margin: 0 0 24px 0; color: #18181b; font-size: 28px; font-weight: 700;">
        Welcome${userName ? `, ${userName}` : ''}!
      </h2>

      <p style="margin: 0 0 20px 0; color: #3f3f46; font-size: 16px;">
        You're all set to supercharge your job search with AI-powered resume tailoring. Here's what Resume Pilot can do for you:
      </p>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding: 16px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="40" valign="top">
                  <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
                    1
                  </div>
                </td>
                <td style="padding-left: 16px;">
                  <h3 style="margin: 0 0 4px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                    Discover Matching Jobs
                  </h3>
                  <p style="margin: 0; color: #71717a; font-size: 14px;">
                    We'll automatically find jobs that match your skills and preferences.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="40" valign="top">
                  <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
                    2
                  </div>
                </td>
                <td style="padding-left: 16px;">
                  <h3 style="margin: 0 0 4px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                    AI-Tailored Resumes
                  </h3>
                  <p style="margin: 0; color: #71717a; font-size: 14px;">
                    Get custom resumes optimized for each job's requirements and ATS systems.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="40" valign="top">
                  <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
                    3
                  </div>
                </td>
                <td style="padding-left: 16px;">
                  <h3 style="margin: 0 0 4px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                    Track Applications
                  </h3>
                  <p style="margin: 0; color: #71717a; font-size: 14px;">
                    Keep all your applications organized in one place.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin: 24px 0 0 0; color: #3f3f46; font-size: 16px;">
        Start by completing your profile and uploading your resume. We'll take it from there!
      </p>
    `,
		ctaText: 'Go to Dashboard',
		ctaUrl: dashboardUrl,
		footer: `
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Manage email preferences</a>
      </p>
    `
	});
}

// Job matches digest email
export interface JobMatch {
	id: string;
	title: string;
	company: string;
	location: string | null;
	isRemote: boolean;
	matchScore: number | null;
	salaryMin: number | null;
	salaryMax: number | null;
	salaryCurrency: string;
	sourceUrl: string;
}

export interface JobMatchesDigestData {
	userName: string;
	jobs: JobMatch[];
	totalNewJobs: number;
	dashboardUrl: string;
	unsubscribeUrl: string;
}

export function jobMatchesDigestEmail(data: JobMatchesDigestData): string {
	const { userName, jobs, totalNewJobs, dashboardUrl, unsubscribeUrl } = data;

	const jobCards = jobs
		.slice(0, 5)
		.map(
			(job) => `
    <tr>
      <td class="job-card" style="padding: 20px; background-color: #f9fafb; border-radius: 8px; margin-bottom: 12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td>
              <h3 style="margin: 0 0 8px 0; color: #18181b; font-size: 18px; font-weight: 600;">
                <a href="${job.sourceUrl}" style="color: #18181b; text-decoration: none;">${job.title}</a>
              </h3>
              <p style="margin: 0 0 8px 0; color: #3f3f46; font-size: 14px; font-weight: 500;">
                ${job.company}
              </p>
              <p style="margin: 0 0 12px 0; color: #71717a; font-size: 14px;">
                ${job.isRemote ? 'Remote' : job.location || 'Location not specified'}
                ${job.salaryMin && job.salaryMax ? ` &bull; ${formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}` : ''}
              </p>
              ${
								job.matchScore
									? `
              <span style="display: inline-block; padding: 4px 12px; background-color: ${getMatchScoreColor(job.matchScore)}; color: #ffffff; border-radius: 9999px; font-size: 12px; font-weight: 600;">
                ${job.matchScore}% Match
              </span>
              `
									: ''
							}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height: 12px;"></td></tr>
  `
		)
		.join('');

	return baseTemplate({
		preheader: `${totalNewJobs} new job match${totalNewJobs !== 1 ? 'es' : ''} found for you!`,
		title: 'New Job Matches',
		content: `
      <h2 style="margin: 0 0 8px 0; color: #18181b; font-size: 28px; font-weight: 700;">
        New Job Matches${userName ? ` for ${userName}` : ''}
      </h2>

      <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 16px;">
        We found <strong>${totalNewJobs} new job${totalNewJobs !== 1 ? 's' : ''}</strong> matching your profile. Here are the top matches:
      </p>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${jobCards}
      </table>

      ${
				totalNewJobs > 5
					? `
      <p style="margin: 24px 0 0 0; color: #71717a; font-size: 14px; text-align: center;">
        + ${totalNewJobs - 5} more job${totalNewJobs - 5 !== 1 ? 's' : ''} in your dashboard
      </p>
      `
					: ''
			}
    `,
		ctaText: 'View All Jobs',
		ctaUrl: `${dashboardUrl}/jobs`,
		footer: `
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Manage email preferences</a> &bull;
        <a href="${dashboardUrl}/profile" style="color: #6b7280; text-decoration: underline;">Update job preferences</a>
      </p>
    `
	});
}

// Resume ready notification email
export interface ResumeReadyData {
	userName: string;
	jobTitle: string;
	company: string;
	matchScore: number | null;
	atsScore: number | null;
	applicationUrl: string;
	unsubscribeUrl: string;
}

export function resumeReadyEmail(data: ResumeReadyData): string {
	const { userName, jobTitle, company, matchScore, atsScore, applicationUrl, unsubscribeUrl } =
		data;

	return baseTemplate({
		preheader: `Your tailored resume for ${jobTitle} at ${company} is ready!`,
		title: 'Resume Ready',
		content: `
      <h2 style="margin: 0 0 8px 0; color: #18181b; font-size: 28px; font-weight: 700;">
        Your Resume is Ready!
      </h2>

      <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 16px;">
        ${userName ? `Hi ${userName}, ` : ''}We've tailored your resume for the following position:
      </p>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px; padding: 24px;">
        <tr>
          <td style="padding: 24px;">
            <h3 style="margin: 0 0 8px 0; color: #18181b; font-size: 20px; font-weight: 600;">
              ${jobTitle}
            </h3>
            <p style="margin: 0 0 20px 0; color: #3f3f46; font-size: 16px;">
              ${company}
            </p>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                ${
									matchScore
										? `
                <td style="padding-right: 16px;">
                  <div style="text-align: center;">
                    <div style="font-size: 32px; font-weight: 700; color: ${getMatchScoreColor(matchScore)};">
                      ${matchScore}%
                    </div>
                    <div style="font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">
                      Match Score
                    </div>
                  </div>
                </td>
                `
										: ''
								}
                ${
									atsScore
										? `
                <td style="padding-left: 16px; ${matchScore ? 'border-left: 1px solid #e5e7eb;' : ''}">
                  <div style="text-align: center; ${matchScore ? 'padding-left: 16px;' : ''}">
                    <div style="font-size: 32px; font-weight: 700; color: ${getAtsScoreColor(atsScore)};">
                      ${atsScore}%
                    </div>
                    <div style="font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">
                      ATS Score
                    </div>
                  </div>
                </td>
                `
										: ''
								}
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin: 24px 0 0 0; color: #3f3f46; font-size: 16px;">
        Your resume has been optimized for this specific job. Review it and apply when you're ready!
      </p>
    `,
		ctaText: 'View Application',
		ctaUrl: applicationUrl,
		footer: `
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Manage email preferences</a>
      </p>
    `
	});
}

// Weekly summary email
export interface WeeklySummaryData {
	userName: string;
	weekStartDate: string;
	stats: {
		jobsDiscovered: number;
		resumesGenerated: number;
		applicationsSubmitted: number;
		topMatch: JobMatch | null;
	};
	dashboardUrl: string;
	unsubscribeUrl: string;
}

export function weeklySummaryEmail(data: WeeklySummaryData): string {
	const { userName, weekStartDate, stats, dashboardUrl, unsubscribeUrl } = data;

	return baseTemplate({
		preheader: `Your weekly job search summary: ${stats.jobsDiscovered} jobs found, ${stats.resumesGenerated} resumes generated`,
		title: 'Weekly Summary',
		content: `
      <h2 style="margin: 0 0 8px 0; color: #18181b; font-size: 28px; font-weight: 700;">
        Your Weekly Summary
      </h2>

      <p style="margin: 0 0 24px 0; color: #71717a; font-size: 14px;">
        Week of ${weekStartDate}
      </p>

      <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 16px;">
        ${userName ? `Hi ${userName}, ` : ''}Here's a summary of your job search activity this week:
      </p>

      <!-- Stats Grid -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td width="33%" style="text-align: center; padding: 20px; background-color: #eff6ff; border-radius: 8px;">
            <div style="font-size: 36px; font-weight: 700; color: #3b82f6;">
              ${stats.jobsDiscovered}
            </div>
            <div style="font-size: 14px; color: #3f3f46; margin-top: 4px;">
              Jobs Found
            </div>
          </td>
          <td width="8"></td>
          <td width="33%" style="text-align: center; padding: 20px; background-color: #f0fdf4; border-radius: 8px;">
            <div style="font-size: 36px; font-weight: 700; color: #22c55e;">
              ${stats.resumesGenerated}
            </div>
            <div style="font-size: 14px; color: #3f3f46; margin-top: 4px;">
              Resumes Created
            </div>
          </td>
          <td width="8"></td>
          <td width="33%" style="text-align: center; padding: 20px; background-color: #faf5ff; border-radius: 8px;">
            <div style="font-size: 36px; font-weight: 700; color: #8b5cf6;">
              ${stats.applicationsSubmitted}
            </div>
            <div style="font-size: 14px; color: #3f3f46; margin-top: 4px;">
              Applications
            </div>
          </td>
        </tr>
      </table>

      ${
				stats.topMatch
					? `
      <div style="margin-top: 32px;">
        <h3 style="margin: 0 0 16px 0; color: #18181b; font-size: 18px; font-weight: 600;">
          Top Match This Week
        </h3>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px;">
          <tr>
            <td style="padding: 20px;">
              <h4 style="margin: 0 0 8px 0; color: #18181b; font-size: 16px; font-weight: 600;">
                ${stats.topMatch.title}
              </h4>
              <p style="margin: 0 0 8px 0; color: #3f3f46; font-size: 14px;">
                ${stats.topMatch.company}
              </p>
              <p style="margin: 0; color: #71717a; font-size: 14px;">
                ${stats.topMatch.isRemote ? 'Remote' : stats.topMatch.location || 'Location not specified'}
                ${stats.topMatch.matchScore ? ` &bull; ${stats.topMatch.matchScore}% Match` : ''}
              </p>
            </td>
          </tr>
        </table>
      </div>
      `
					: ''
			}

      <p style="margin: 32px 0 0 0; color: #3f3f46; font-size: 16px;">
        Keep your profile updated to get the best job matches!
      </p>
    `,
		ctaText: 'View Dashboard',
		ctaUrl: dashboardUrl,
		footer: `
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Manage email preferences</a> &bull;
        <a href="${dashboardUrl}/profile" style="color: #6b7280; text-decoration: underline;">Update profile</a>
      </p>
    `
	});
}

// Application status change email
export interface ApplicationStatusData {
	userName: string;
	jobTitle: string;
	company: string;
	oldStatus: string;
	newStatus: string;
	applicationUrl: string;
	unsubscribeUrl: string;
}

export function applicationStatusEmail(data: ApplicationStatusData): string {
	const { userName, jobTitle, company, newStatus, applicationUrl, unsubscribeUrl } = data;

	const statusConfig = getStatusConfig(newStatus);

	return baseTemplate({
		preheader: `Application update: ${jobTitle} at ${company} - ${statusConfig.label}`,
		title: 'Application Status Update',
		content: `
      <h2 style="margin: 0 0 24px 0; color: #18181b; font-size: 28px; font-weight: 700;">
        Application Update
      </h2>

      <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 16px;">
        ${userName ? `Hi ${userName}, ` : ''}Your application status has been updated:
      </p>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px;">
        <tr>
          <td style="padding: 24px;">
            <h3 style="margin: 0 0 8px 0; color: #18181b; font-size: 20px; font-weight: 600;">
              ${jobTitle}
            </h3>
            <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 16px;">
              ${company}
            </p>

            <div style="display: inline-block; padding: 8px 16px; background-color: ${statusConfig.bgColor}; color: ${statusConfig.textColor}; border-radius: 8px; font-weight: 600;">
              ${statusConfig.emoji} ${statusConfig.label}
            </div>

            ${statusConfig.message ? `<p style="margin: 16px 0 0 0; color: #71717a; font-size: 14px;">${statusConfig.message}</p>` : ''}
          </td>
        </tr>
      </table>
    `,
		ctaText: 'View Application',
		ctaUrl: applicationUrl,
		footer: `
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Manage email preferences</a>
      </p>
    `
	});
}

// Helper functions
function formatSalary(min: number, max: number, currency: string): string {
	const formatter = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: currency || 'USD',
		maximumFractionDigits: 0
	});
	return `${formatter.format(min)} - ${formatter.format(max)}`;
}

function getMatchScoreColor(score: number): string {
	if (score >= 80) return '#22c55e'; // green
	if (score >= 60) return '#3b82f6'; // blue
	if (score >= 40) return '#f59e0b'; // amber
	return '#ef4444'; // red
}

function getAtsScoreColor(score: number): string {
	if (score >= 80) return '#22c55e'; // green
	if (score >= 60) return '#3b82f6'; // blue
	if (score >= 40) return '#f59e0b'; // amber
	return '#ef4444'; // red
}

interface StatusConfig {
	label: string;
	emoji: string;
	bgColor: string;
	textColor: string;
	message?: string;
}

function getStatusConfig(status: string): StatusConfig {
	const configs: Record<string, StatusConfig> = {
		pending: {
			label: 'Pending Review',
			emoji: '📋',
			bgColor: '#fef3c7',
			textColor: '#92400e'
		},
		reviewing: {
			label: 'Under Review',
			emoji: '👀',
			bgColor: '#dbeafe',
			textColor: '#1e40af',
			message: 'The employer is reviewing your application.'
		},
		applied: {
			label: 'Applied',
			emoji: '✅',
			bgColor: '#dcfce7',
			textColor: '#166534',
			message: 'Your application has been submitted successfully.'
		},
		interview: {
			label: 'Interview Scheduled',
			emoji: '📅',
			bgColor: '#e0e7ff',
			textColor: '#3730a3',
			message: 'Congratulations! You have an interview scheduled.'
		},
		offer: {
			label: 'Offer Received',
			emoji: '🎉',
			bgColor: '#dcfce7',
			textColor: '#166534',
			message: "Amazing news! You've received a job offer."
		},
		rejected: {
			label: 'Not Selected',
			emoji: '😔',
			bgColor: '#fee2e2',
			textColor: '#991b1b',
			message: "Unfortunately, you weren't selected for this position. Keep going!"
		},
		saved: {
			label: 'Saved',
			emoji: '⭐',
			bgColor: '#fef3c7',
			textColor: '#92400e'
		},
		not_relevant: {
			label: 'Not Relevant',
			emoji: '🚫',
			bgColor: '#f3f4f6',
			textColor: '#374151'
		}
	};

	return (
		configs[status] || {
			label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
			emoji: '📝',
			bgColor: '#f3f4f6',
			textColor: '#374151'
		}
	);
}
