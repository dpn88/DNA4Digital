function dna4d_menu_sc(){
  return do_shortcode('[staggered_menu items="Home Page:/|Offer:/offer|About:/about|Contact Us:contact|Blog:/Blog" label="Menu" align="right"]');
}
add_shortcode('dna4d_menu', 'dna4d_menu_sc');
