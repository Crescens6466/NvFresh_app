import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiArrowLeft,
  HiOutlinePhone,
  HiOutlineEnvelope,
  HiOutlineMapPin,
  HiOutlineClock,
  HiOutlineTruck,
} from "react-icons/hi2";
import { FaWhatsapp } from "react-icons/fa";
import { api } from "../api.js";
import "./StaticPage.css";

const DEFAULT_PHONE = "+91 98765 43210";
const WHATSAPP_MESSAGE = "Hi NvFresh, I have a question about my order.";

export default function Contact() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(DEFAULT_PHONE);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        if (s?.phone_number) setPhone(s.phone_number);
      })
      .catch(() => {});
  }, []);

  const whatsappNumber = phone.replace(/\D/g, "");
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <div className="static-page page-fade">
      <div className="static-page-back">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>Contact Us</h2>
      </div>

      <p>Have a question about your order or our products? We're here to help.</p>

      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary contact-whatsapp-btn"
      >
        <FaWhatsapp /> Chat with us on WhatsApp
      </a>

      <div className="contact-list">
        <div className="contact-item">
          <HiOutlinePhone />
          <div>
            <h5>Call Us</h5>
            <p>{phone}</p>
          </div>
        </div>
        <div className="contact-item">
          <HiOutlineEnvelope />
          <div>
            <h5>Email</h5>
            <p>support@nvfresh.in</p>
          </div>
        </div>
        <div className="contact-item">
          <HiOutlineMapPin />
          <div>
            <h5>Address</h5>
            <p>NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India</p>
          </div>
        </div>
        <div className="contact-item">
          <HiOutlineClock />
          <div>
            <h5>Support Hours</h5>
            <p>Everyday, 7:00 AM – 9:00 PM</p>
          </div>
        </div>
        <div className="contact-item">
          <HiOutlineTruck />
          <div>
            <h5>Delivery Day</h5>
            <p>Orders confirmed Saturday, delivered fresh every Sunday morning</p>
          </div>
        </div>
      </div>
    </div>
  );
}
