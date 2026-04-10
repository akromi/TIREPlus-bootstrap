<?php
/**
 * TirePlus Contact Form Handler
 * Receives form submissions and emails them to info@tireplus.ca
 */

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
if (!empty($_POST['website'])) {
    header('Location: /contact-us/?status=success');
    exit;
}

// Sanitize inputs
$name    = htmlspecialchars(strip_tags(trim($_POST['name'] ?? '')));
$email   = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$phone   = htmlspecialchars(strip_tags(trim($_POST['phone'] ?? '')));
$vehicle = htmlspecialchars(strip_tags(trim($_POST['vehicle'] ?? '')));
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
$body .= "Name:    $name\n";
$body .= "Email:   $email\n";
$body .= "Phone:   $phone\n";
$body .= "Vehicle: $vehicle\n\n";
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
