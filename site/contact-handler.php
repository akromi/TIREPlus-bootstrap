<?php
/**
 * TirePlus Contact Form Handler (Bilingual EN/FR)
 */
$recaptcha_secret = '6LcDWbYsAAAAAGIfYLAZXWbAYGaOlIPKohUxhaTA';
$recaptcha_threshold = 0.5;

$lang = ($_POST['lang'] ?? '') === 'fr' ? 'fr' : 'en';
$contact_path = $lang === 'fr' ? '/fr/contactez-nous/' : '/contact-us/';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header("Location: $contact_path"); exit; }
if (!isset($_POST['math']) || intval($_POST['math']) !== 18) { header("Location: {$contact_path}?status=error&reason=math"); exit; }
if (!empty($_POST['company_url'])) { header("Location: {$contact_path}?status=success"); exit; }

$recaptcha_token = $_POST['g-recaptcha-response'] ?? '';
if (!empty($recaptcha_token)) {
    $verify_data = http_build_query(['secret'=>$recaptcha_secret,'response'=>$recaptcha_token,'remoteip'=>$_SERVER['REMOTE_ADDR']??'']);
    $ctx = stream_context_create(['http'=>['method'=>'POST','header'=>'Content-Type: application/x-www-form-urlencoded','content'=>$verify_data,'timeout'=>5]]);
    $res = @file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, $ctx);
    if ($res !== false) { $r = json_decode($res, true); if (!$r['success'] || ($r['score']??0) < $recaptcha_threshold) { header("Location: {$contact_path}?status=error&reason=captcha"); exit; } }
}

$name    = htmlspecialchars(strip_tags(trim($_POST['name'] ?? '')));
$email   = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$phone   = htmlspecialchars(strip_tags(trim($_POST['phone'] ?? '')));
$vehicle = htmlspecialchars(strip_tags(trim($_POST['vehicle'] ?? '')));
$plate   = strtoupper(htmlspecialchars(strip_tags(trim($_POST['plate'] ?? ''))));
$message = htmlspecialchars(strip_tags(trim($_POST['message'] ?? '')));

if (empty($name) || empty($email) || empty($message)) { header("Location: {$contact_path}?status=error&reason=required"); exit; }
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { header("Location: {$contact_path}?status=error&reason=email"); exit; }

$to = 'info@tireplus.ca';
$subject = 'TirePlus Website Contact: ' . $name;
$lang_label = $lang === 'fr' ? 'French' : 'English';
$body = "New contact form submission from tireplus.ca ($lang_label)\n=============================================\n\nName:          $name\nEmail:         $email\nPhone:         $phone\nVehicle:       $vehicle\nLicense Plate: $plate\nLanguage:      $lang_label\n\nMessage:\n$message\n";
$headers = "From: noreply@tireplus.ca\r\nReply-To: $email\r\nX-Mailer: TirePlus-Contact-Form\r\nContent-Type: text/plain; charset=UTF-8\r\n";

$sent = mail($to, $subject, $body, $headers);
header("Location: {$contact_path}?status=" . ($sent ? 'success' : 'error&reason=send'));
exit;
?>
