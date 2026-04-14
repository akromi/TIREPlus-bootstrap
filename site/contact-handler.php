<?php
/**
 * TirePlus Contact Form Handler
 * Receives form submissions, verifies reCAPTCHA v3, and emails them to info@tireplus.ca
 */

// reCAPTCHA v3 secret key
$recaptcha_secret = '6LcDWbYsAAAAAGIfYLAZXWbAYGaOlIPKohUxhaTA';
$recaptcha_threshold = 0.5; // Score 0.0 (bot) to 1.0 (human)

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /contact-us/');
    exit;
}

// Anti-spam: math challenge (12 + 6 = 18)
if (!isset($_POST['math']) || intval($_POST['math']) !== 18) {
    header('Location: /contact-us/?status=error&reason=math');
    exit;
}

// Honeypot: hidden field that bots fill in
if (!empty($_POST['company_url'])) {
    // Silently accept — bot thinks it succeeded
    header('Location: /contact-us/?status=success');
    exit;
}

// reCAPTCHA v3 verification
$recaptcha_token = $_POST['g-recaptcha-response'] ?? '';
if (!empty($recaptcha_token)) {
    $verify_url = 'https://www.google.com/recaptcha/api/siteverify';
    $verify_data = http_build_query([
        'secret'   => $recaptcha_secret,
        'response' => $recaptcha_token,
        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '',
    ]);

    $opts = [
        'http' => [
            'method'  => 'POST',
            'header'  => 'Content-Type: application/x-www-form-urlencoded',
            'content' => $verify_data,
            'timeout' => 5,
        ],
    ];
    $context = stream_context_create($opts);
    $verify_response = @file_get_contents($verify_url, false, $context);

    if ($verify_response !== false) {
        $result = json_decode($verify_response, true);
        if (!$result['success'] || ($result['score'] ?? 0) < $recaptcha_threshold) {
            header('Location: /contact-us/?status=error&reason=captcha');
            exit;
        }
    }
    // If verification request fails (network issue), allow form through
    // Math + honeypot still provide protection
}

// Sanitize inputs
$name    = htmlspecialchars(strip_tags(trim($_POST['name'] ?? '')));
$email   = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$phone   = htmlspecialchars(strip_tags(trim($_POST['phone'] ?? '')));
$vehicle = htmlspecialchars(strip_tags(trim($_POST['vehicle'] ?? '')));
$plate   = strtoupper(htmlspecialchars(strip_tags(trim($_POST['plate'] ?? ''))));
$message = htmlspecialchars(strip_tags(trim($_POST['message'] ?? '')));

// Validate required fields
if (empty($name) || empty($email) || empty($message)) {
    header('Location: /contact-us/?status=error&reason=required');
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('Location: /contact-us/?status=error&reason=email');
    exit;
}

// Build the email
$to      = 'info@tireplus.ca';
$subject = 'TirePlus Website Contact: ' . $name;

$body  = "New contact form submission from tireplus.ca\n";
$body .= "=============================================\n\n";
$body .= "Name:          $name\n";
$body .= "Email:         $email\n";
$body .= "Phone:         $phone\n";
$body .= "Vehicle:       $vehicle\n";
$body .= "License Plate: $plate\n\n";
$body .= "Message:\n$message\n";

$headers  = "From: noreply@tireplus.ca\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "X-Mailer: TirePlus-Contact-Form\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// Send
$sent = mail($to, $subject, $body, $headers);

if ($sent) {
    header('Location: /contact-us/?status=success');
} else {
    header('Location: /contact-us/?status=error&reason=send');
}
exit;
?>
