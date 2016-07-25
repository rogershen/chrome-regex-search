// common.js (chrome-regex-search)

/* Split mode modifiers off a regex, if any.
   Returns {str: regex string, modes...}, where str[mode] is true if
   that mode is set, e.g., "i": true if case-insensitive. */
function splitRegexString(str) {
  RE_MODES = /^\(\?([a-z]{1,})\)(.*)$/
  var matches;
  var retval = {};
  if ( (matches=RE_MODES.exec(str)) !== null) {
    retval.str = matches[2];
    var modes = matches[1];
    for(modeidx in modes) {
      retval[modes[modeidx]] = true;
    }
  } else {
    retval.str = str;
  }
  return retval;
}

