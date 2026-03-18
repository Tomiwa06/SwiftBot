import { BookingDetails } from "../types";
import { GOOGLE_SHEET_ID } from "../constants";

/*
  ===================================================================
  GOOGLE APPS SCRIPT INSTRUCTIONS (UPDATED FOR CALENDAR READING)
  ===================================================================
  
  1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}
  2. Go to "Extensions" > "Apps Script".
  3. **CRITICAL**: In the left sidebar, click "+" next to "Services", select "Google Calendar API", and click "Add".
  4. Replace ALL code with the block below.

  // --- BEGIN APPS SCRIPT CODE ---
  
  var PRIMARY_CALENDAR_ID = 'primary'; 
  
  // The emails to check for availability and invite to events
  var GUEST_LIST = [
    "akinpetertomiwa@gmail.com",
    "akintomiwa0604@gmail.com"
  ];
  
  function doPost(e) {
    var lock = LockService.getScriptLock();
    // Shorter lock for availability checks, longer for booking
    lock.tryLock(10000); 
    
    try {
      var rawData = e.postData.contents;
      var data = JSON.parse(rawData);
      
      // ROUTING BASED ON ACTION
      if (data.action === "check_availability") {
         var slots = checkAvailability(data.date);
         return ContentService.createTextOutput(JSON.stringify({ 
           "status": "success", 
           "slots": slots 
         })).setMimeType(ContentService.MimeType.JSON);
      }
      else if (data.action === "book_appointment") {
         var result = handleBooking(data);
         return ContentService.createTextOutput(JSON.stringify(result))
           .setMimeType(ContentService.MimeType.JSON);
      }
      else {
         throw new Error("Unknown action: " + data.action);
      }
      
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    } finally {
      lock.releaseLock();
    }
  }

  // --- FEATURE: CHECK AVAILABILITY ---
  function checkAvailability(dateStr) {
    // dateStr is "YYYY-MM-DD"
    // Define working hours in WAT (West Africa Time - UTC+1)
    // Adjust these if your calendar settings are different.
    var startHour = 9;
    var endHour = 17; // 5 PM
    
    var timeMin = new Date(dateStr + "T09:00:00+01:00");
    var timeMax = new Date(dateStr + "T17:00:00+01:00");
    
    // Build list of calendar IDs to check (Primary + Guests)
    var items = [{id: PRIMARY_CALENDAR_ID}];
    for (var i = 0; i < GUEST_LIST.length; i++) {
      items.push({id: GUEST_LIST[i]});
    }

    // Call Google Calendar API FreeBusy
    var request = {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: items
    };
    
    var response = Calendar.Freebusy.query(request);
    
    // Define potential 1-hour slots
    var potentialSlots = [];
    for (var h = startHour; h < endHour; h++) {
       // Create ISO string for this slot start in WAT
       // Note: This is a simplified construction. Ideally use moment.js or strict parsing, 
       // but for Apps Script with fixed offset +01:00 this works.
       var hourStr = h < 10 ? "0" + h : "" + h;
       var slotIso = dateStr + "T" + hourStr + ":00:00+01:00";
       potentialSlots.push(new Date(slotIso));
    }
    
    // Filter slots
    var availableSlots = potentialSlots.filter(function(slotStart) {
      var slotEnd = new Date(slotStart.getTime() + (60 * 60 * 1000)); // +1 hour
      
      // Check every calendar in the response
      var calendars = response.calendars;
      for (var key in calendars) {
        var busyList = calendars[key].busy;
        for (var b = 0; b < busyList.length; b++) {
          var busyStart = new Date(busyList[b].start);
          var busyEnd = new Date(busyList[b].end);
          
          // Check for overlap
          if (slotStart < busyEnd && slotEnd > busyStart) {
            return false; // This slot is busy
          }
        }
      }
      return true; // No overlap found
    });
    
    // Format output as "HH:mm" strings
    return availableSlots.map(function(d) {
      var h = d.getHours(); // Local script time (usually matches setting)
      // Force format
      var mm = d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes();
      var hh = h < 10 ? "0" + h : h;
      return hh + ":" + mm;
    });
  }

  // --- FEATURE: BOOKING ---
  function handleBooking(data) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
    if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var timestamp = new Date();
    
    // 1. SAVE TO SHEET
    sheet.appendRow([
      timestamp, 
      data.name, 
      data.email, 
      data.service, 
      data.datetime, 
      data.confirmationCode
    ]);
    
    // 2. CREATE CALENDAR EVENT
    var meetLink = null;
    var calendarError = null;
    
    try {
      meetLink = createCalendarEvent(data);
    } catch (calError) {
      calendarError = calError.toString();
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 8).setValue("Cal Error: " + calendarError);
    }
    
    // 3. SEND CONFIRMATION EMAIL
    try {
      if (data.email) {
        sendConfirmationEmail(data, meetLink);
      }
    } catch (emailError) {
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 7).setValue("Email Error: " + emailError.toString());
    }
    
    return { "status": "success", "meetLink": meetLink };
  }

  function createCalendarEvent(data) {
    var startTime = new Date(data.datetime);
    if (isNaN(startTime.getTime())) throw new Error("Invalid Date");
    var endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); 
    
    var attendeesList = [{email: data.email}];
    for (var i = 0; i < GUEST_LIST.length; i++) {
      if (GUEST_LIST[i] && GUEST_LIST[i].indexOf('@') > -1) {
        attendeesList.push({email: GUEST_LIST[i]});
      }
    }

    var eventResource = {
      summary: "SwiftBooks: " + data.service + " (" + data.name + ")",
      description: "Client: " + data.name + "\nRef: " + data.confirmationCode,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      attendees: attendeesList,
      conferenceData: {
        createRequest: {
          requestId: Math.random().toString(36).substring(7),
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      }
    };
    
    var event = Calendar.Events.insert(eventResource, PRIMARY_CALENDAR_ID, {
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });
    
    return event.hangoutLink;
  }

  function sendConfirmationEmail(data, meetLink) {
    var subject = "Confirmed: Your Appointment with SwiftBooks";
    
    var meetHtml = "";
    if (meetLink) {
      meetHtml = 
        "<div style='background-color: #e8f0fe; border: 1px solid #1a73e8; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;'>" +
          "<p style='margin: 0 0 10px 0; font-weight: bold; color: #1a73e8; font-size: 16px;'>Virtual Meeting Details</p>" +
          "<a href='" + meetLink + "' style='background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;'>Join Google Meet</a>" +
          "<p style='margin: 10px 0 0 0; font-size: 12px; color: #555;'>" + meetLink + "</p>" +
        "</div>";
    }

    // Header Text: SWIFTBOOKS LTD (Montserrat)
    var htmlBody = 
      "<div style='font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;'>" +
        "<div style='background-color: #ffffff; padding: 25px 20px; text-align: center; border-bottom: 2px solid #ce1126;'>" +
           "<h1 style='margin: 0; color: #001740; font-family: \"Montserrat\", \"Trebuchet MS\", Helvetica, sans-serif; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;'>SWIFTBOOKS LTD</h1>" +
        "</div>" +
        "<div style='padding: 20px; border: 1px solid #ddd; border-top: none;'>" +
          "<p>Dear " + data.name + ",</p>" +
          "<p>Your appointment has been booked successfully.</p>" +
          meetHtml +
          "<div style='background-color: #f9f9f9; padding: 15px; border-left: 4px solid #ce1126; margin: 20px 0;'>" +
            "<p style='margin: 5px 0;'><strong>Service:</strong> " + data.service + "</p>" +
            "<p style='margin: 5px 0;'><strong>Date & Time:</strong> " + data.datetime + "</p>" +
            "<p style='margin: 5px 0;'><strong>Reference Code:</strong> " + data.confirmationCode + "</p>" +
          "</div>" +
          "<p style='margin-top: 30px; font-size: 12px; color: #888;'>SwiftBooks Ltd</p>" +
        "</div>" +
      "</div>";
      
    MailApp.sendEmail({
      to: data.email,
      subject: subject,
      htmlBody: htmlBody
    });
  }
  
  // --- END APPS SCRIPT CODE ---
*/

// PASTE YOUR WEB APP URL HERE
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxvmqSnmBUaqhLpBjtVteFwasucPAFXL0r3QFZWgIlntEC9fRVdFCJne5-8PSow5k9P/exec"; 

// Function 1: Book Appointment
export const saveBookingToSheet = async (booking: BookingDetails): Promise<string | null> => {
  if (!APPS_SCRIPT_URL) return null;

  try {
    const payload = { ...booking, action: "book_appointment" };
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "cors", 
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return null;
    const result = await response.json();
    return result.meetLink || null;

  } catch (error) {
    console.error("Booking Error", error);
    return null;
  }
};

// Function 2: Check Availability
export const checkAvailability = async (date: string): Promise<string[]> => {
  if (!APPS_SCRIPT_URL) return [];

  console.log(`[SwiftBooks] Checking availability for ${date}...`);

  try {
    const payload = { action: "check_availability", date: date };
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return [];
    const result = await response.json();
    
    if (result.status === "success" && Array.isArray(result.slots)) {
      console.log(`[SwiftBooks] Found slots:`, result.slots);
      return result.slots;
    }
    return [];

  } catch (error) {
    console.error("Availability Check Error", error);
    return [];
  }
};
