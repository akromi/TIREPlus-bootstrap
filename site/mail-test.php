<?php
$sent = mail('info@tireplus.ca', 'TirePlus Test', 'This is a test email from staging2.', 'From: noreply@tireplus.ca');
echo $sent ? 'mail() returned TRUE - check your inbox/spam' : 'mail() returned FALSE - mail() is blocked on this server';
?>