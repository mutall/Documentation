<?php
//
//Catch all errors, including warnings.
\set_error_handler(function($errno, $errstr, $errfile, $errline /*, $errcontext*/) {
    throw new \ErrorException($errstr, 0, $errno, $errfile, $errline);
});
//
//Schema is almost awys required in php tests
include_once '../code/schema.php';
//
//Resolve the qustionnaire reference
include_once '../code/sql.php';
//
$editor = new editor("billboard", "billboard");
//
//echo json_encode($editor->describe());
$sql = $editor->stmt();
//
echo "<pre>".$sql."</pre>";
