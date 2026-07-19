# MKV Academy Website

A static MKV Academy website for engineering education, course sales, student
accounts, private lesson videos, assignments, and an owner/admin upload studio.

The site uses semantic HTML, Tailwind CSS via CDN, vanilla JavaScript, and
Supabase for the account/content system. There is no npm install and no build
step required.

## Running It

Open `index.html` in a browser.

Course/testimonial JSON fetches work best when the site is served over http(s),
but the important scripts include local fallbacks so basic previewing still
works from disk.

## Main Structure

```text
/
  index.html                 Home page
  courses.html               Course catalog
  students.html              Student login and paid-course dashboard
  admin.html                 Owner/admin course and lesson upload studio
  instructor.html            Instructor teaching workspace
  chat.html                  Dedicated student/admin messaging page
  contact.html               Contact form
  about.html                 About page
  services.html              Consulting/services page
  hardware-startups.html     Hardware startup services
  manufacturers.html         Manufacturer services
  community.html             Community page
  faq.html                   FAQ page
  privacy.html               Privacy policy
  terms.html                 Terms of service

  js/
    components.js            Shared navbar/footer
    supabase-client.js       Supabase setup and shared helpers
    identity.js              Supabase Auth login/signup/logout
    portal.js                Student paid-course dashboard
    admin.js                 Admin course/lesson uploads
    instructor.js            Instructor courses, quizzes, and submissions
    chat.js                  Account-based in-app chat page
    landing-videos.js        Homepage welcome video rendering
    courses.js               Course catalog rendering/filtering
    main.js                  Loading screen, cookie banner, scroll tools

  data/
    courses.json             Static course catalog fallback
    testimonials.json        Testimonial content
    instructors.json         Instructor content

  database/
    supabase-schema.sql      Supabase tables, RLS policies, and storage policies
```

## Supabase Setup

This site now uses Supabase instead of Netlify Identity.

Supabase provides:

- Auth for student/admin registration and login
- Postgres tables for profiles, courses, lessons, orders, and enrollments
- Edge Functions for Flutterwave checkout, payment webhooks, and email sending
- private Storage buckets for videos and assignments
- Row Level Security so students only access paid courses

Setup steps:

1. Create a Supabase project.
2. Run `database/supabase-schema.sql` in the Supabase SQL Editor.
3. Copy `config.example.js` to `config.js`.
4. Add your Supabase project URL and anon public key in `config.js`.
5. Create the first owner/admin accounts from `students.html`.
6. In Supabase, run `database/admin-users.sql` or set approved users in
   `profiles.role`.

If you already ran an older version of the schema, run the relevant upgrade
file instead of re-running the whole schema. For the homepage welcome videos,
use `database/upgrade-welcome-videos.sql`.
For instructor dashboards, certificates, quizzes, referrals, coupons, analytics,
drip content, and payment event logs, use `database/upgrade-academy-system.sql`.

The schema creates these private buckets:

```text
course-videos
course-assignments
course-materials
assignment-submissions
welcome-videos
```

## Student Accounts

`students.html` is the student dashboard.

Logged-out students see login/signup forms. Logged-in students see the courses
that exist in their `enrollments` records. If a student has no enrollment, the
dashboard shows a clear empty state.

Lesson videos and assignments are not public links. The dashboard requests a
temporary signed URL from Supabase Storage only when the logged-in student has
access to the course.

## Admin Uploads

`admin.html` is the owner/admin studio.

Admins can:

- create courses
- upload lesson videos
- upload assignment files
- upload four homepage welcome videos
- create coupons
- view analytics for revenue, students, enrollments, submissions, and payment events
- add external stream URLs for Bunny, Cloudflare, Mux, YouTube, or another provider
- save lesson title, description, sort order, and file paths
- review recently uploaded lessons
- search students
- grant or revoke course access manually
- review, grade, and comment on assignment submissions

Only users with `profiles.role` set to `admin` or `owner` can use the admin
workspace. Storage uploads are protected by Supabase Row Level Security.

Approved admin emails included in the SQL setup:

- `israelefe093@gmail.com`
- `josephcelestinediamond@gmail.com`

## Instructor Dashboard

`instructor.html` gives instructors a focused teaching workspace. Instructor,
admin, and owner accounts can view assigned courses, review recent submissions,
and create basic quizzes. Owners assign instructors to courses through the
`course_instructors` table.

## Homepage Welcome Videos

`index.html` includes a four-video welcome section near the top of the page.
The videos are managed from `admin.html` and stored in the public
`welcome-videos` Supabase Storage bucket, with metadata in `landing_videos`.

These are public marketing videos designed to intrigue visitors before login.
Paid lesson videos still use the private course buckets and enrollment checks.

## In-App Chat

`chat.html` is a full-page messaging area, not a popup. Students can start
private support conversations from their account, and admin/owner users can see
the inbox and reply.

The chat uses these Supabase tables:

```text
chat_threads
chat_messages
```

Messages are protected by Row Level Security. Students can only read their own
threads, while admin/owner accounts can read and reply across the inbox.
When Supabase Realtime is available, the page subscribes to new messages for the
active conversation and keeps timed refresh as a fallback.

## Payments and Flutterwave

When Supabase is configured, the course catalog starts checkout through:

```text
supabase/functions/create-flutterwave-checkout
```

Flutterwave then calls:

```text
supabase/functions/flutterwave-webhook
```

The webhook function:

1. receive the Flutterwave webhook
2. verify the transaction with Flutterwave
3. create/update an `orders` record
4. insert an `enrollments` record for the paid course
5. create a dashboard notification for the student
6. write every received, rejected, verified, failed, and confirmed webhook into `payment_events`

Once the enrollment exists, the course appears in the student's dashboard
automatically.

Required Supabase Edge Function environment variables:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FLUTTERWAVE_SECRET_KEY
FLUTTERWAVE_WEBHOOK_HASH
PUBLIC_SITE_URL
RESEND_API_KEY
MKV_FROM_EMAIL
```

## Course Videos and Assignments

Video files are saved in Supabase Storage, not directly inside the database.
The database stores the course ID, lesson title, description, and file paths.
For larger production video delivery, admins can also use Bunny Stream,
Cloudflare Stream, Mux, YouTube, or another external stream URL per lesson.

Example:

```text
Storage:
course-videos/solidworks-beginner-cswa/lesson-1.mp4
course-assignments/solidworks-beginner-cswa/assignment-1.pdf

Database:
lessons.course_id = solidworks-beginner-cswa
lessons.video_path = solidworks-beginner-cswa/lesson-1.mp4
lessons.assignment_path = solidworks-beginner-cswa/assignment-1.pdf
```

Students can submit completed assignment files from their dashboard. Admins can
review those submissions from `admin.html`, add a grade/feedback, and notify the
student.

## Certificates, Quizzes, Referrals, Drip Content, and Coupons

The student dashboard includes certificate status, quiz listings, referral
invites, and lesson drip support using `lessons.unlock_after_days`.

The admin studio includes coupon creation and analytics. Checkout accepts an
optional coupon code and applies the discount server-side before creating the
Flutterwave payment.

## Notifications and Email

Dashboard notifications are stored in the `notifications` table. The included
`send-notification-email` Edge Function is ready for Resend-based emails once
`RESEND_API_KEY` and `MKV_FROM_EMAIL` are configured.

## Files To Edit Most Often

- Navbar/footer: `js/components.js`
- Course catalog fallback: `data/courses.json` and `js/courses.js`
- Supabase config: `config.js`
- Student dashboard logic: `js/portal.js`
- Admin upload logic: `js/admin.js`
- Instructor dashboard logic: `js/instructor.js`
- Chat logic: `js/chat.js`
- Landing video logic: `js/landing-videos.js`
- Payment functions: `supabase/functions/create-flutterwave-checkout` and `supabase/functions/flutterwave-webhook`
- Email function: `supabase/functions/send-notification-email`
- Database/storage rules: `database/supabase-schema.sql`

## Before Launch

- Add real Supabase credentials in `config.js`.
- Run the SQL schema in Supabase.
- Create the first owner/admin profile and run `database/admin-users.sql`.
- Upload four welcome videos from `admin.html`.
- Add real course videos and assignments through `admin.html`.
- Deploy the Supabase Edge Functions and configure Flutterwave webhooks.
- Add Resend credentials if you want email notifications.
- Add final contact details, legal review, instructor photos, testimonials,
  logos, favicon, and OG image before launch.
