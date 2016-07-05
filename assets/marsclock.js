// this script is based on jtauber's work: jtauber.github.io/mars-clock/
// However his program only runs for Mars 24 hour mode, which is not the one we needed.
// Thus a lot of functions are added.
// His work is using MIT license thus we are allowed to use and modify and inherent the MIT license.



   function cos(deg) {
      return Math.cos(deg * Math.PI / 180);
   }
   function sin(deg) {
      return Math.sin(deg * Math.PI / 180);
   }
   function h_to_hms(h) {
      var x = h * 3600;
      var hh = Math.floor(x / 3600);
      if (hh < 10) hh = "0" + hh;
      var y = x % 3600;
      var mm = Math.floor(y / 60);
      if (mm < 10) {
         mm = "0" + mm;
      } else if (mm == 60) {
         mm = "00";
      }

      var ss = Math.round(y % 60);
      if (ss < 10) {
         ss = "0" + ss;
      } else if (ss == 60) {
         ss = "00";
      }
      return hh + ":" + mm + ":" + ss;
   }

   function h_to_hms_interimm(h) { // input h is in unit of martian day
      var h_interimm = h * 24.659790025;
      if (h_interimm <= 0) {
          return NaN
      } else if (h_interimm < 24 && h_interimm > 0 ) {
         var h_24 = h_interimm // - 0.659790025; // to calculate within 24 earth hours
         var x = h_24 * 3600; // in earth seconds
         var hh = Math.floor(x / 3600 ); // number of earth hours
         if (hh < 10 && hh >= 0) hh = "0" + hh;
         var y = x % 3600; // the earth seconds left
         var mm = Math.floor(y / 60);
         if (mm < 10 && mm >= 0) {
            mm = "0" + mm;
         } else if (mm == 60) {
            mm = "00";
         }
         var ss = Math.round(y % 60);
         if (ss < 10 && ss >= 0) {
            ss = "0" + ss;
         } else if (ss == 60) {
            ss = "00";
         }
         return hh + ":" + mm + ":" + ss + " " + "+" + "00" + ":" + "00";
      } else {
         var h_extra = h_interimm - 24.0;
         var total_seconds_extra = h_extra * 3600; // total extra seconds besides the 24 hours
         var mm_extra = Math.floor(total_seconds_extra / 60);
         if (mm_extra < 10) mm_extra = "0" + mm_extra;
         var ss_extra = Math.round(total_seconds_extra % 60);
         if (ss_extra < 10) {
            ss_extra = "0" + ss_extra;
         } else if (ss_extra == 60 ) {
            ss_extra = "00";
         }
         return " " + "+" + mm_extra + ":" + ss_extra;
      }
   }
   function add_commas(n) {
      n += "";
      var x = n.split(".");
      var x1 = x[0];
      var x2 = x.length > 1 ? "." + x[1] : "";
      var rgx = /(\d+)(\d{3})/;
      while (rgx.test(x1)) {
           x1 = x1.replace(rgx, "$1" + "," + "$2");
      }
      return x1 + x2;
   }
   function within_24(n) {
      if (n < 0) {
           n += 24;
      } else if (n >= 24) {
           n -= 24;
      }
      return n;
   }
   // The following are some functions customized for InterImm
   // BEGIN-InterImm
   function is_leap_year_mars(year) {
      // A function that determines whether a year is a leap year on Mars
      var leap_year_flag = 0;

      if (year % 3000 == 0) {
         leap_year_flag = 0;
     } else if (year % 1000 == 0) {
        leap_year_flag = 1;
     } else if (year % 100 == 0) {
        leap_year_flag = 0;
     } else if (year % 2 != 0 || year % 10 == 0) {
        leap_year_flag = 1;
     } else {
        leap_year_flag = 0;
     }
     return leap_year_flag;
   }

   function year_total_days(year) {
      return 668 + is_leap_year_mars(year);
   }

   function month_mod_6_is_not_zero(month) {
      if ((month) % 6!=0) {
         return 1;
      } else {
         return 0;
      }
   }

   function month_total_days(year,month) {
      var days = 28;

      if (is_leap_year_mars(year) && month == 24) {
         days = 28;
      } else if (is_leap_year_mars(year) && month != 24) {
         days = 27 + month_mod_6_is_not_zero(month);
      } else if (!(is_leap_year_mars(year))) {
        days = 27 + month_mod_6_is_not_zero(month);
      } else {
        days = Number.NaN;
      }
     return days;
  }

	// #InterImm# returns the month and date given a number of dates.
	// #InterImm# calendar_date(a number of days, which year we are calculating)
	function mars_calendar_date(days, year) {
        var days_flag = days;
        var month_flag = 1;
        var return_month;
        var return_day;

        while (month_flag < 25) {

            if (month_flag == 24) {     // the last month is special because it might change with year
            	return_month = month_flag;
                return_day = days_flag;   // using tuple to avoid modification
            } else if ( (month_flag < 24) &&  (days_flag < (27 + 1 + (month_flag % 6!= 0 ))) ) {   // the condition for days makes sure that days is never larger than days in that month
            	return_month = month_flag;
                return_day = days_flag;
	            break;
            } else if ( (month_flag < 24) && ((days_flag) > (27 + (month_flag % 6 != 0))) ) {
            	days_flag = days_flag - 27 - ( month_flag % 6 != 0 );
                month_flag = month_flag +1 ;
	            continue;
            } else {
            return NaN; //"Unhandled in calendar_date(days, year) function! (inner for loop) "
            break;
            }

        }
        return [return_month,return_day];

    }


  function mars_year_month(days) {
      var year_flag = 1;
      var mars_calendar_data_list;

      var md = days // #InterImm# calculate the total martian days since year 0

      while (md > (668.0 + is_leap_year_mars(year_flag) ) ) {
      	year_flag = year_flag + 1
        md = md - 668.0 - is_leap_year_mars(year_flag)
      }

      mars_calendar_data_list = mars_calendar_date(md+1,year_flag-1);

      return [year_flag, mars_calendar_data_list[0], Math.floor(mars_calendar_data_list[1]) ]
  }

  function set_current_tz() {

    var tz_set_value = document.getElementById("setLocalTimezone").value

    // if ( (tz_set_value < 0) || (tz_set_value > 24) ) {
    //   setLocalTimezone.addEventListener("input", $(".mymd_interimm_set_tz").text('错误时区输入'));
    //   setLocalTimezone.addEventListener("input", $(".mt_interimm_set_tz").text('错误时区输入'));
    // }
    // else {
      return tz_set_value;
    //}


  }

  document.getElementById("setLocalTimezone").value

   // END-InterImm

   function update() {
      var input_date = $(".custom-datetime").val() + ' UTC+'+$("#set-datetime-tz-earth").val();
      if ($(".custom-datetime").val()) {
           // Slightly evil but mostly functional date parsing from human input.
           // Works reasonably well in most browsers :)
           var d = new Date(input_date);
      } else {
      //      var d_temp = new Date();

      //      var d = new Date(d_temp.getFullYear(),d_temp.getMonth(),d_temp.getDay(),d_temp.getHours(),d_temp.getMinutes(),d_temp.getSeconds());
            var d = new Date(); 
    }

      if (d.getTime()) {
           $(".manual-input-invalid").hide();
           $(".date-conversion-results").show();
      } else {
           $(".manual-input-invalid").show();
           $(".date-conversion-results").hide();
      }

      $(".utc-time").text(d.toUTCString());
      var millis = d.getTime(); // Get the number of milliseconds since 1970/01/01
      var jd_ut = 2440587.5 + (millis / 8.64E7);
      var jd_tt = jd_ut + (35 + 32.184) / 86400;
      var j2000 = jd_tt - 2451545.0;
      var m = (19.3870 + 0.52402075 * j2000) % 360;
      var alpha_fms = (270.3863 + 0.52403840 * j2000) % 360;
      var e = (0.09340 + 2.477E-9 * j2000);
      var pbs =
           0.0071 * cos((0.985626 * j2000 /  2.2353) +  49.409) +
           0.0057 * cos((0.985626 * j2000 /  2.7543) + 168.173) +
           0.0039 * cos((0.985626 * j2000 /  1.1177) + 191.837) +
           0.0037 * cos((0.985626 * j2000 / 15.7866) +  21.736) +
           0.0021 * cos((0.985626 * j2000 /  2.1354) +  15.704) +
           0.0020 * cos((0.985626 * j2000 /  2.4694) +  95.528) +
           0.0018 * cos((0.985626 * j2000 / 32.8493) +  49.095);
      var nu_m = (10.691 + 3.0E-7 * j2000) * sin(m) +
           0.623 * sin(2 * m) +
           0.050 * sin(3 * m) +
           0.005 * sin(4 * m) +
           0.0005 * sin(5 * m) +
           pbs;
      var nu = nu_m + m;
      var l_s = (alpha_fms + nu_m) % 360;
      var eot = 2.861 * sin(2 * l_s) - 0.071 * sin(4 * l_s) + 0.002 * sin(6 * l_s) - nu_m;
      var eot_h = eot * 24 / 360;
      var msd = (((j2000 - 4.5) / 1.027491252) + 44796.0 - 0.00096);
      var mtc = (24 * msd) % 24;

      var m2e = 1.027491252; // 88775.0/86400; // #InterImm# the ratio of mars sol day and earth 24-hour day; we can use 1.027491252 or 88775.0/86400 which are different from each other

      var setCurrentTimezoneValue = set_current_tz(); // Get Input TimeZone from Input Label



      var yeah_0_days_to_j2000 = 10845.1403356/m2e; // #Interimm# calculate the number of days from mars year 0 to j2000

//      var mars_days_from_j2000 = (((j2000 - 4.5) / 1.027491252) - 0.00096) + yeah_0_days_to_j2000 ; // #Interimm# calculate days passed since yeah 0
      var mars_days_from_year_0 = msd - 34242.27180 - 0.73027  + 1/m2e // 35183.387152777777778/m2e ; // #Interimm# calculate days passed since yeah 0
      var mars_days_from_year_0_tz = msd - 34242.27180 - 0.73027  + 1/m2e + mtz_diff0_sec(setCurrentTimezoneValue)/3600/24/m2e; // WITH TIMEZONE SET // #Interimm# calculate days passed since yeah 0
      var mtc_interimm = (mars_days_from_year_0) % 1; // MTC using InterImm method
      var mtc_interimm_tz = (mars_days_from_year_0_tz) % 1; // WITH TIMEZONE SET // MTC using InterImm method

      var mars_calendar_list = mars_year_month( mars_days_from_year_0 );
      var mars_calendar_list_tz = mars_year_month( mars_days_from_year_0_tz ); // WITH TIMEZONE SET

      var mymd_year = mars_calendar_list[0] ; // #Interimm# mars calendar year
      var mymd_month = mars_calendar_list[1]; // #Interimm# mars calendar month
      var mymd_day = mars_calendar_list[2]; // #Interimm# mars calendar day

      // WITH TIMEZONE SET: YEAR MONTH DAY
      var mymd_year_tz = mars_calendar_list_tz[0] ; // #Interimm# mars calendar year
      var mymd_month_tz = mars_calendar_list_tz[1]; // #Interimm# mars calendar month
      var mymd_day_tz = mars_calendar_list_tz[2]; // #Interimm# mars calendar day

      var mymd_interimm = mymd_year + "年" + mymd_month + "月" + mymd_day + "日";// #Interimm# calculate mars calendar day
      var mymd_interimm_tz = mymd_year_tz + "年" + mymd_month_tz + "月" + mymd_day_tz + "日";// WITH TIMEZONE SET // #Interimm# calculate mars calendar day

      var curiosity_lambda = 360 - 137.4;
      var curiosity_sol = Math.floor(msd - curiosity_lambda / 360) - 49268;
      var curiosity_lmst = within_24(mtc - curiosity_lambda * 24 / 360);
      var curiosity_ltst = within_24(curiosity_lmst + eot * 24 / 360);

      var opportunity_sol_date = msd - 46235 - 0.042431;
      var opportunity_sol = Math.floor(opportunity_sol_date);
      var opportunity_mission = (24 * opportunity_sol_date) % 24;
      var opportunity_ltst = within_24(opportunity_mission + eot * 24 / 360);

      $(".millis").text(add_commas(millis));
      $(".jd_ut").text(add_commas(jd_ut.toFixed(5)));
      $(".jd_tt").text(add_commas(jd_tt.toFixed(5)));
      $(".j2000").text(add_commas(j2000.toFixed(5)));
      $(".m").text(m.toFixed(5));
      $(".alpha_fms").text(alpha_fms.toFixed(5));
      $(".pbs").text(pbs.toFixed(5));
      $(".e").text(e.toFixed(5));
      $(".nu_m").text(nu_m.toFixed(5));
      $(".nu").text(nu.toFixed(5));
      $(".l_s").text(l_s.toFixed(5));
      $(".eot").text(eot.toFixed(5));
      $(".eot_h").text(h_to_hms(eot_h.toFixed(5)));
//      $(".msd").text(add_commas(msd.toFixed(5)));
      $(".msd").text(add_commas(mars_days_from_year_0.toFixed(5)));
      $(".mymd_interimm").text( mymd_interimm); // #Interimm# the year layout using interimm's calendar

      // if ( (setCurrentTimezoneValue < 0) || (setCurrentTimezoneValue > 24) || (setCurrentTimezoneValue == Undifined) ) {
      //   $(".mymd_interimm_tz").text('错误时区输入');
      //   $(".mt_interimm_tz").text('错误时区输入');
      // }
      // else {
      $(".mymd_interimm_tz").text( mymd_interimm_tz); // #Interimm# the year layout using interimm's calendar
      //}


//      $(".mtc").text(h_to_hms(mtc));

      if (mtc_interimm > 0) {
	      $(".mtc").text(h_to_hms(mtc));
	//	  $(".mtc").text(h_to_hms(mtc_interimm));
    	  $(".mt_interimm").text(h_to_hms_interimm(mtc_interimm)); // #Interimm# clock using interimm's time keeping
        $(".mt_interimm_tz").text(h_to_hms_interimm(mtc_interimm_tz)); //WITH TIMEZONE SET // #Interimm# clock using interimm's time keeping
        $(".msd_interimm").text(add_commas(mars_days_from_year_0.toFixed(5)));
        $(".mymd_interimm").text( mymd_interimm); // #Interimm# the year layout using interimm's calendar
  //      $(".mtc").text(h_to_hms(mtc));

  } else {
	      $(".mtc").text("试试其它时间");
          $(".mt_interimm").text("试试其它时间"); // #Interimm# clock using interimm's time keeping
         $(".msd_interimm").text("试试其它时间");
          $(".mymd_interimm").text("试试其它时间"); // #Interimm# the year layout using interimm's calendar
  //      $(".mtc").text(h_to_hms(mtc));
  }
      $(".curiosity_lmst").text(h_to_hms(curiosity_lmst));
      $(".curiosity_ltst").text(h_to_hms(curiosity_ltst));
      $(".curiosity_sol").text(curiosity_sol);

      $(".opportunity_mission").text(h_to_hms(opportunity_mission));
      $(".opportunity_ltst").text(h_to_hms(opportunity_ltst));
      $(".opportunity_sol").text(opportunity_sol);
   }


   $(function() {
      update();
      $(".explanation").hide();
      setInterval(update, 10);
      $(".explanation-link").hover(function() {
           $(".explanation").hide();
           $(this).css("font-weight", "bold");
           $(".help").hide();
           $($(this).data("explanation")).show();
      }, function() {
           $(this).css("font-weight", "300");
           $(".help").show();
           $($(this).data("explanation")).hide();
      });
      $('.automatic-input').mouseup(function() {
           // Changing the contents of this element so frequently
           // stops the click handler from firing, so we need to
           // watch for mouseup instead
           $('.automatic-input').hide();
           $('.manual-input').show();
           $('.custom-datetime').select();
      });
      $('.custom-datetime').blur(function() {
           if (! $('.custom-datetime').val()) {
               $('.manual-input').hide();
               $('.automatic-input').show();
           }
      });
      $('.earth-date-input .clear-button').click(function() {
           $('.custom-datetime').val('');
           $('.manual-input').hide();
           $('.automatic-input').show();
      });
   });
