// Mars Timezone JS
// The doc about timezone on Mars is located here:
// http://book.interimm.org/navigator/mars.html#marstimezone

function mtz_timezones() {
   var list = []
   for (i=0; i<24; i++) {
      list.push(i);
   }
   list.push(0.659790025)
   return list
}

function mtz_diff0_sec(local) { // given the timezone calculate the different between local time and timezone 0
   // return the hours advanced

   return mtz_timezones()[local]*60*60; // return result in seconds
}

function tz_convert(local,target) { //should take two parameters at least: source timezone and taget timezone

	return mtz_diff0_sec(target) - mtz_diff0_sec(local);
}
