function dna4d_menu_sc(){
  return do_shortcode('[staggered_menu items="Home:/|Services:/services|About:/about|Selected Work:/selected-work|Blog:/blog|Contact:/contact" label="Menu" align="right"]');
}
add_shortcode('dna4d_menu', 'dna4d_menu_sc');
