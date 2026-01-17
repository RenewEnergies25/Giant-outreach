-- Seed Data for Dead Lead Reactivation System
-- Run this in Supabase SQL Editor to populate the database with sample data
-- NOTE: Run the migrations first before running this seed data

-- Insert sample contacts with enhanced schema fields
INSERT INTO contacts (
  id, ghl_contact_id, ghl_location_id, email, first_name, last_name, phone, full_name,
  conversation_stage, is_qualified, qualified_at, is_opted_out, calendar_link_sent,
  bump_count, questions_asked, message_count, last_message_at, needs_human_review,
  status, created_at, updated_at
) VALUES
(
  '11111111-1111-1111-1111-111111111111', 'ghl_001', 'loc_001',
  'john.doe@example.com', 'John', 'Doe', '+447976015890', 'John Doe',
  'in_conversation', false, null, false, false,
  0, 1, 4, NOW() - INTERVAL '8 days', false,
  'active', NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'
),
(
  '22222222-2222-2222-2222-222222222222', 'ghl_002', 'loc_001',
  'jane.smith@example.com', 'Jane', 'Smith', '+447976015891', 'Jane Smith',
  'in_conversation', false, null, false, false,
  1, 2, 3, NOW() - INTERVAL '2 days', true,
  'active', NOW() - INTERVAL '8 days', NOW() - INTERVAL '2 hours'
),
(
  '33333333-3333-3333-3333-333333333333', 'ghl_003', 'loc_001',
  'bob.wilson@example.com', 'Bob', 'Wilson', '+447976015892', 'Bob Wilson',
  'calendar_link_sent', false, null, false, true,
  0, 0, 3, NOW() - INTERVAL '4 days', false,
  'active', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 hours'
),
(
  '44444444-4444-4444-4444-444444444444', 'ghl_004', 'loc_001',
  'alice.brown@example.com', 'Alice', 'Brown', '+447976015893', 'Alice Brown',
  'booked', true, NOW() - INTERVAL '1 day', false, true,
  0, 0, 2, NOW() - INTERVAL '1 day', false,
  'qualified', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 hour'
),
(
  '55555555-5555-5555-5555-555555555555', 'ghl_005', 'loc_001',
  'charlie.davis@example.com', 'Charlie', 'Davis', '+447976015894', 'Charlie Davis',
  'in_conversation', false, null, false, false,
  0, 1, 3, NOW() - INTERVAL '6 hours', false,
  'active', NOW() - INTERVAL '2 days', NOW() - INTERVAL '30 minutes'
),
(
  '66666666-6666-6666-6666-666666666666', 'ghl_006', 'loc_001',
  'diana.jones@example.com', 'Diana', 'Jones', '+447976015895', 'Diana Jones',
  'opted_out', false, null, true, false,
  2, 0, 4, NOW() - INTERVAL '5 days', false,
  'inactive', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days'
),
(
  '77777777-7777-7777-7777-777777777777', 'ghl_007', 'loc_001',
  'edward.white@example.com', 'Edward', 'White', '+447976015896', 'Edward White',
  'stalled', false, null, false, false,
  3, 0, 5, NOW() - INTERVAL '6 days', false,
  'stalled', NOW() - INTERVAL '10 days', NOW() - INTERVAL '6 days'
)
ON CONFLICT (id) DO UPDATE SET
  ghl_contact_id = EXCLUDED.ghl_contact_id,
  conversation_stage = EXCLUDED.conversation_stage,
  is_qualified = EXCLUDED.is_qualified,
  bump_count = EXCLUDED.bump_count,
  message_count = EXCLUDED.message_count;

-- Insert sample messages with enhanced schema fields
INSERT INTO messages (
  id, contact_id, ghl_contact_id, contact_email, direction, channel, content,
  message_type, ai_generated, ai_classification, detected_intent, bump_number, created_at
) VALUES
-- John Doe conversation
(
  'm1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'ghl_001',
  'john.doe@example.com', 'outbound', 'sms',
  'OK my manager asked me to reach out, but I hate bugging people with calls - were you still interested in car finance? We''ve got some new offers I can check for you?',
  'conversation', true, 'initial_outreach', null, null, NOW() - INTERVAL '10 days'
),
(
  'm1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'ghl_001',
  'john.doe@example.com', 'inbound', 'sms',
  'Yes, I am interested but what kind of cars can I get?',
  'conversation', false, 'question', 'question', null, NOW() - INTERVAL '9 days'
),
(
  'm1111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 'ghl_001',
  'john.doe@example.com', 'outbound', 'sms',
  'That''s great to hear! What type of vehicle are you looking for? Do you have a specific model in mind?',
  'conversation', true, 'follow_up', null, null, NOW() - INTERVAL '9 days'
),
(
  'm1111111-1111-1111-1111-111111111114', '11111111-1111-1111-1111-111111111111', 'ghl_001',
  'john.doe@example.com', 'inbound', 'sms',
  'Looking for an SUV, maybe a BMW X3 or similar',
  'conversation', false, 'answer', 'answer', null, NOW() - INTERVAL '8 days'
),

-- Jane Smith conversation (needs review - asking many questions)
(
  'm2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'ghl_002',
  'jane.smith@example.com', 'outbound', 'sms',
  'OK my manager asked me to reach out, but I hate bugging people with calls - were you still interested in car finance? We''ve got some new offers I can check for you?',
  'conversation', true, 'initial_outreach', null, null, NOW() - INTERVAL '5 days'
),
(
  'm2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'ghl_002',
  'jane.smith@example.com', 'inbound', 'sms',
  'What''s the minimum deposit required? And what about bad credit?',
  'conversation', false, 'question', 'question', null, NOW() - INTERVAL '4 days'
),
(
  'm2222222-2222-2222-2222-222222222223', '22222222-2222-2222-2222-222222222222', 'ghl_002',
  'jane.smith@example.com', 'outbound', 'sms',
  'Great questions! We help customers obtain car finance even with bad credit. I''m in admin, but I can arrange a call with an advisor who can go through all the options with you. Would that help?',
  'conversation', true, 'information', null, null, NOW() - INTERVAL '3 days'
),

-- Bob Wilson conversation (calendar link sent)
(
  'm3333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333333', 'ghl_003',
  'bob.wilson@example.com', 'outbound', 'sms',
  'OK my manager asked me to reach out, but I hate bugging people with calls - were you still interested in car finance? We''ve got some new offers I can check for you?',
  'conversation', true, 'initial_outreach', null, null, NOW() - INTERVAL '5 days'
),
(
  'm3333333-3333-3333-3333-333333333332', '33333333-3333-3333-3333-333333333333', 'ghl_003',
  'bob.wilson@example.com', 'inbound', 'sms',
  'Yes sounds good, I''m ready to proceed',
  'conversation', false, 'agreement', 'agreement', null, NOW() - INTERVAL '4 days' + INTERVAL '1 hour'
),
(
  'm3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'ghl_003',
  'bob.wilson@example.com', 'outbound', 'sms',
  'You can book a call with an advisor directly here: https://api.leadconnectorhq.com/widget/booking/xN7Gt5quOob1VH1yK6O2
Once it''s booked, we''ll take care of the rest for you.',
  'calendar_sent', true, 'booking', null, null, NOW() - INTERVAL '4 days'
),

-- Alice Brown conversation (qualified - booked)
(
  'm4444444-4444-4444-4444-444444444441', '44444444-4444-4444-4444-444444444444', 'ghl_004',
  'alice.brown@example.com', 'outbound', 'sms',
  'OK my manager asked me to reach out, but I hate bugging people with calls - were you still interested in car finance? We''ve got some new offers I can check for you?',
  'conversation', true, 'initial_outreach', null, null, NOW() - INTERVAL '2 days'
),
(
  'm4444444-4444-4444-4444-444444444442', '44444444-4444-4444-4444-444444444444', 'ghl_004',
  'alice.brown@example.com', 'inbound', 'sms',
  'Yes! I really need to get a new car. Can someone call me tomorrow at 2pm?',
  'conversation', false, 'agreement', 'agreement', null, NOW() - INTERVAL '1 day'
),

-- Charlie Davis conversation (in conversation)
(
  'm5555555-5555-5555-5555-555555555551', '55555555-5555-5555-5555-555555555555', 'ghl_005',
  'charlie.davis@example.com', 'outbound', 'sms',
  'OK my manager asked me to reach out, but I hate bugging people with calls - were you still interested in car finance? We''ve got some new offers I can check for you?',
  'conversation', true, 'initial_outreach', null, null, NOW() - INTERVAL '1 day'
),
(
  'm5555555-5555-5555-5555-555555555552', '55555555-5555-5555-5555-555555555555', 'ghl_005',
  'charlie.davis@example.com', 'inbound', 'sms',
  'Yeah maybe. How much would I need to pay each month?',
  'conversation', false, 'question', 'question', null, NOW() - INTERVAL '12 hours'
),
(
  'm5555555-5555-5555-5555-555555555553', '55555555-5555-5555-5555-555555555555', 'ghl_005',
  'charlie.davis@example.com', 'outbound', 'sms',
  'That depends on a few things! What type of vehicle are you looking for and do you have a specific model in mind?',
  'conversation', true, 'qualification', null, null, NOW() - INTERVAL '6 hours'
),

-- Diana Jones conversation (opted out)
(
  'm6666666-6666-6666-6666-666666666661', '66666666-6666-6666-6666-666666666666', 'ghl_006',
  'diana.jones@example.com', 'outbound', 'sms',
  'OK my manager asked me to reach out, but I hate bugging people with calls - were you still interested in car finance?',
  'conversation', true, 'initial_outreach', null, null, NOW() - INTERVAL '7 days'
),
(
  'm6666666-6666-6666-6666-666666666662', '66666666-6666-6666-6666-666666666666', 'ghl_006',
  'diana.jones@example.com', 'outbound', 'sms',
  'Just checking in - let me know if you''d like to discuss car finance options?',
  'bump', false, null, null, 1, NOW() - INTERVAL '6 days'
),
(
  'm6666666-6666-6666-6666-666666666663', '66666666-6666-6666-6666-666666666666', 'ghl_006',
  'diana.jones@example.com', 'outbound', 'sms',
  'Hi Diana, just a final follow up on car finance. Let me know if interested!',
  'bump', false, null, null, 2, NOW() - INTERVAL '5 days' + INTERVAL '6 hours'
),
(
  'm6666666-6666-6666-6666-666666666664', '66666666-6666-6666-6666-666666666666', 'ghl_006',
  'diana.jones@example.com', 'inbound', 'sms',
  'Please delete my information and stop contacting me',
  'opt_out', false, null, 'rejection', null, NOW() - INTERVAL '5 days'
),

-- Edward White conversation (stalled - no response after bumps)
(
  'm7777777-7777-7777-7777-777777777771', '77777777-7777-7777-7777-777777777777', 'ghl_007',
  'edward.white@example.com', 'outbound', 'sms',
  'OK my manager asked me to reach out, but I hate bugging people with calls - were you still interested in car finance?',
  'conversation', true, 'initial_outreach', null, null, NOW() - INTERVAL '10 days'
),
(
  'm7777777-7777-7777-7777-777777777772', '77777777-7777-7777-7777-777777777777', 'ghl_007',
  'edward.white@example.com', 'inbound', 'sms',
  'Maybe, not sure yet',
  'conversation', false, 'unclear', 'unclear', null, NOW() - INTERVAL '9 days'
),
(
  'm7777777-7777-7777-7777-777777777773', '77777777-7777-7777-7777-777777777777', 'ghl_007',
  'edward.white@example.com', 'outbound', 'sms',
  'No problem! What type of vehicle are you looking for?',
  'conversation', true, 'qualification', null, null, NOW() - INTERVAL '9 days'
),
(
  'm7777777-7777-7777-7777-777777777774', '77777777-7777-7777-7777-777777777777', 'ghl_007',
  'edward.white@example.com', 'outbound', 'sms',
  'Just checking in - did you have a chance to think about what vehicle you''re after?',
  'bump', false, null, null, 1, NOW() - INTERVAL '8 days'
),
(
  'm7777777-7777-7777-7777-777777777775', '77777777-7777-7777-7777-777777777777', 'ghl_007',
  'edward.white@example.com', 'outbound', 'sms',
  'Hi Edward, following up one more time on car finance. Let me know!',
  'bump', false, null, null, 2, NOW() - INTERVAL '7 days'
)
ON CONFLICT (id) DO UPDATE SET
  message_type = EXCLUDED.message_type,
  detected_intent = EXCLUDED.detected_intent,
  bump_number = EXCLUDED.bump_number;

-- Insert sample escalations with enhanced schema fields
INSERT INTO escalations (
  id, contact_id, message_id, escalation_type, reason, status,
  appointment_time, calendar_name, created_at
) VALUES
(
  'e4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444',
  'm4444444-4444-4444-4444-444444444442', 'booked',
  'Appointment booked - QUALIFIED LEAD', 'pending',
  NOW() + INTERVAL '1 day' + INTERVAL '14 hours', 'Sales Team',
  NOW() - INTERVAL '1 day'
),
(
  'e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
  'm2222222-2222-2222-2222-222222222222', 'needs_review',
  'Lead asked 2 questions - may need human touch', 'pending',
  null, null,
  NOW() - INTERVAL '3 days'
),
(
  'e3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
  'm3333333-3333-3333-3333-333333333333', 'calendar_sent',
  'Calendar link sent - awaiting booking', 'pending',
  null, null,
  NOW() - INTERVAL '4 days'
)
ON CONFLICT (id) DO UPDATE SET
  escalation_type = EXCLUDED.escalation_type,
  reason = EXCLUDED.reason;

-- Insert sample daily metrics for the last 30 days with enhanced schema
INSERT INTO daily_metrics (
  date, messages_sent, messages_received, bumps_sent,
  calendar_links_sent, bookings, opt_outs, human_reviews,
  ai_replies, manual_replies, escalations
)
SELECT
  (CURRENT_DATE - (INTERVAL '1 day' * generate_series))::date as date,
  floor(random() * 50 + 30)::int as messages_sent,
  floor(random() * 30 + 15)::int as messages_received,
  floor(random() * 10 + 5)::int as bumps_sent,
  floor(random() * 8 + 2)::int as calendar_links_sent,
  floor(random() * 5 + 1)::int as bookings,
  floor(random() * 3)::int as opt_outs,
  floor(random() * 4 + 1)::int as human_reviews,
  floor(random() * 40 + 20)::int as ai_replies,
  floor(random() * 15 + 5)::int as manual_replies,
  floor(random() * 5)::int as escalations
FROM generate_series(0, 29)
ON CONFLICT (date) DO UPDATE SET
  bumps_sent = EXCLUDED.bumps_sent,
  calendar_links_sent = EXCLUDED.calendar_links_sent,
  bookings = EXCLUDED.bookings,
  human_reviews = EXCLUDED.human_reviews;
