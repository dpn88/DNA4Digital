add_action('init', function () {
  if ( function_exists('wp_render_skip_link') ) {
    remove_action('wp_body_open', 'wp_render_skip_link');
  }
});