import { Component, AfterViewInit } from '@angular/core';

declare const lucide: {
  createIcons: () => void;
};

@Component({
  selector: 'app-book-detail',
  templateUrl: './book-detail.component.html',
  styleUrls: ['./book-detail.component.css']
})
export class BookDetailComponent implements AfterViewInit {

  // Variantes disponibles
  selectedFormat: string = 'Tapa Blanda';

  // Formatos con sus precios correspondientes
  formats = [
    { name: 'Tapa Blanda', price: '$29.500', isSelected: true },
    { name: 'Tapa Dura', price: '$38.200', isSelected: false },
    { name: 'Digital (ePub)', price: '$12.900', isSelected: false }
  ];

  // Preguntas mock
  questions = [
    {
      question: '¿Tienen stock de la edición en tapa dura?',
      answer: 'Hola! Sí, nos queda el último ejemplar disponible en tapa dura. ¡Saludos!'
    },
    {
      question: '¿Viene con el mapa de Cuatro Esquinas desplegable?',
      answer: '¡Hola! Sí, esta edición incluye el mapa ilustrado en las primeras páginas.'
    }
  ];

  newQuestionText: string = '';

  constructor() { }

  ngAfterViewInit(): void {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  selectFormat(formatName: string): void {
    this.selectedFormat = formatName;
    this.formats.forEach(f => f.isSelected = (f.name === formatName));
  }

  addQuestion(): void {
    if (this.newQuestionText.trim()) {
      this.questions.unshift({
        question: this.newQuestionText,
        answer: 'Respuesta pendiente del vendedor...'
      });
      this.newQuestionText = '';
    }
  }

}
