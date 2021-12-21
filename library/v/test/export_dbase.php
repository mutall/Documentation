<?php
//
//Catch all errors, including warnings.
\set_error_handler(function($errno, $errstr, $errfile, $errline /*, $errcontext*/) {
    throw new \ErrorException($errstr, 0, $errno, $errfile, $errline);
});
//
//Schema is almost always required in php tests
include_once '../code/schema.php';

include_once '../code/sql.php';

//
$dbase = (new database("billboard"))->export_structure();
//
echo "<pre>".json_encode($dbase)."</pre>";
