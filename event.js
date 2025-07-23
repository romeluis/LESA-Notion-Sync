export class Event {
  constructor({
    id = null,
    name = "New Event",
    emoji = "🌎",
    description = "NONE",
    location = "TBA",
    type = "LESA Event",
    organization = null,
    day = 0,
    month = null,
    year = null,
    startHour = 0,
    startMinute = 0,
    endHour = 0,
    endMinute = 0,
    price = 0,
    link = '0',
    calendarLink = 'NONE',
    isCpsifFunded = 0,
  } = {}) {
    this.id = id;
    this.name = name;
    this.emoji = emoji;
    this.description = description;
    this.location = location;
    this.type = type;
    this.organization = organization;
    this.day = day;
    this.month = month;
    this.year = year;
    this.startHour = startHour;
    this.startMinute = startMinute;
    this.endHour = endHour;
    this.endMinute = endMinute;
    this.price = price;
    this.link = link;
    this.calendarLink = calendarLink;
    this.isCpsifFunded = isCpsifFunded;
  }
}
